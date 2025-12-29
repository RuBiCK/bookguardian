// ============================================================================
// SAM CLIENT - Replicate API Integration
// ============================================================================

import Replicate from 'replicate'
import { BoundingBox, SegmentationMask } from '../ai/types'
import { normalizePolygon, simplifyPolygon, validatePolygon, denormalizePolygon } from './polygon-utils'
import { getSAMConfig, validateSAMConfig } from './config'

export interface SAMSegmentationRequest {
  imageBase64: string  // Base64 encoded image (same format as GPT-4V)
  boxes: BoundingBox[]  // Array of normalized bounding boxes (0-1)
  imageWidth: number    // Image width in pixels
  imageHeight: number   // Image height in pixels
}

export interface SAMSegmentationResponse {
  masks: SegmentationMask[]
  successCount: number
  failureCount: number
}

/**
 * Replicate SAM Client
 * Handles segmentation mask generation using Segment Anything Model via Replicate API
 */
export class ReplicateSAMClient {
  private client: Replicate
  private config = getSAMConfig()

  constructor(apiKey?: string) {
    const key = apiKey || this.config.replicateApiKey

    if (!key) {
      throw new Error('Replicate API key is required')
    }

    this.client = new Replicate({
      auth: key,
    })
  }

  /**
   * Generate segmentation masks from bounding boxes
   *
   * @param request - Segmentation request with image and bounding boxes
   * @returns Array of segmentation masks (one per box, or undefined if failed)
   */
  async segmentFromBoxes(
    request: SAMSegmentationRequest
  ): Promise<SAMSegmentationResponse> {
    // Validate config
    const validation = validateSAMConfig(this.config)
    if (!validation.valid) {
      throw new Error(`SAM config invalid: ${validation.error}`)
    }

    // Validate input
    if (request.boxes.length === 0) {
      return { masks: [], successCount: 0, failureCount: 0 }
    }

    try {
      // Convert normalized boxes to absolute pixel coordinates for SAM
      const absoluteBoxes = this.denormalizeBoundingBoxes(
        request.boxes,
        request.imageWidth,
        request.imageHeight
      )

      // Format boxes for SAM API (x1, y1, x2, y2 format)
      const boxPrompts = absoluteBoxes.map(box => ({
        x1: box.x,
        y1: box.y,
        x2: box.x + box.width,
        y2: box.y + box.height,
      }))

      console.log(`[SAM] Segmenting ${request.boxes.length} books...`)
      console.log(`[SAM] Using model: ${this.config.model}`)
      const startTime = Date.now()

      // Get the latest version of the model
      const model = await this.client.models.get(this.config.model.split('/')[0], this.config.model.split('/')[1])
      const latestVersion = model.latest_version?.id

      if (!latestVersion) {
        throw new Error(`Could not find latest version for model ${this.config.model}`)
      }

      console.log(`[SAM] Using version: ${latestVersion}`)

      // Call Replicate SAM API
      const output = await this.client.run(
        `${this.config.model}:${latestVersion}` as `${string}/${string}:${string}`,
        {
          input: {
            image: request.imageBase64,
            box_prompts: JSON.stringify(boxPrompts),
            multimask_output: false,  // Single mask per prompt
          },
        }
      ) as any

      const latency = Date.now() - startTime
      console.log(`[SAM] API call completed in ${latency}ms`)

      // Process SAM output
      const masks = await this.processSAMOutput(
        output,
        request.imageWidth,
        request.imageHeight,
        request.boxes.length
      )

      const successCount = masks.filter(m => m !== undefined).length
      const failureCount = request.boxes.length - successCount

      console.log(`[SAM] Success: ${successCount}/${request.boxes.length} masks generated`)

      return {
        masks: masks as SegmentationMask[],
        successCount,
        failureCount,
      }
    } catch (error) {
      console.error('[SAM] Segmentation failed:', error)
      throw new Error(`SAM segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process SAM output and convert to normalized polygon masks
   */
  private async processSAMOutput(
    output: any,
    imageWidth: number,
    imageHeight: number,
    expectedCount: number
  ): Promise<(SegmentationMask | undefined)[]> {
    const masks: (SegmentationMask | undefined)[] = []

    try {
      // SAM 2 output format varies, need to handle multiple formats
      // Common formats: array of masks, or object with 'masks' field
      let maskData: any[] = []

      console.log('[SAM] Output type:', typeof output)
      console.log('[SAM] Output keys:', output && typeof output === 'object' ? Object.keys(output) : 'N/A')
      console.log('[SAM] Full output:', JSON.stringify(output, null, 2))

      if (Array.isArray(output)) {
        maskData = output
      } else if (output && typeof output === 'object' && output.individual_masks) {
        // Replicate SAM 2 format: { combined_mask, individual_masks }
        maskData = output.individual_masks
        console.log('[SAM] Found individual_masks array with', maskData.length, 'items')
      } else if (output && typeof output === 'object' && output.masks) {
        maskData = output.masks
      } else if (output && typeof output === 'object' && output.output) {
        maskData = output.output
      } else {
        console.warn('[SAM] Unexpected output format:', typeof output)
        return Array(expectedCount).fill(undefined)
      }

      // Process each mask
      for (let i = 0; i < expectedCount; i++) {
        const mask = maskData[i]

        if (!mask) {
          masks.push(undefined)
          continue
        }

        // Log first mask to see structure
        if (i === 0) {
          console.log('[SAM] First mask type:', typeof mask)
          console.log('[SAM] First mask value:', mask)
          console.log('[SAM] Is string?:', typeof mask === 'string')
          if (typeof mask === 'object') {
            console.log('[SAM] First mask keys:', Object.keys(mask))
          }
        }

        try {
          // Extract contour points from mask
          // SAM returns different formats: RLE, polygon, or binary mask
          const contourPoints = this.extractContourPoints(mask)

          if (!contourPoints || contourPoints.length < 3) {
            console.warn(`[SAM] Invalid contour for mask ${i}: insufficient points`)
            masks.push(undefined)
            continue
          }

          // Normalize coordinates
          const normalizedContour = normalizePolygon(
            contourPoints,
            imageWidth,
            imageHeight
          )

          // Validate polygon
          if (!validatePolygon(normalizedContour, true)) {
            console.warn(`[SAM] Invalid polygon for mask ${i}`)
            masks.push(undefined)
            continue
          }

          // Create simplified version for hover detection
          const simplifiedContour = simplifyPolygon(
            normalizedContour,
            this.config.simplificationTolerance
          )

          masks.push({
            contour: normalizedContour,
            simplifiedContour,
            confidence: mask.confidence || 1.0,
          })
        } catch (error) {
          console.error(`[SAM] Error processing mask ${i}:`, error)
          masks.push(undefined)
        }
      }
    } catch (error) {
      console.error('[SAM] Error processing output:', error)
      return Array(expectedCount).fill(undefined)
    }

    return masks
  }

  /**
   * Extract contour points from SAM mask
   * Handles multiple SAM output formats
   */
  private extractContourPoints(mask: any): Array<{x: number, y: number}> {
    // If mask already has contour/polygon field
    if (mask.contour && Array.isArray(mask.contour)) {
      return mask.contour
    }

    if (mask.polygon && Array.isArray(mask.polygon)) {
      return mask.polygon
    }

    // If mask has segmentation field (COCO format)
    if (mask.segmentation && Array.isArray(mask.segmentation)) {
      const points: Array<{x: number, y: number}> = []
      for (let i = 0; i < mask.segmentation.length; i += 2) {
        points.push({
          x: mask.segmentation[i],
          y: mask.segmentation[i + 1],
        })
      }
      return points
    }

    // If mask has coordinates field
    if (mask.coordinates && Array.isArray(mask.coordinates)) {
      return mask.coordinates.map((coord: any) => ({
        x: coord[0] || coord.x,
        y: coord[1] || coord.y,
      }))
    }

    console.warn('[SAM] Unknown mask format:', Object.keys(mask))
    return []
  }

  /**
   * Convert normalized BoundingBox to absolute pixel coordinates
   */
  private denormalizeBoundingBoxes(
    boxes: BoundingBox[],
    width: number,
    height: number
  ): Array<{x: number, y: number, width: number, height: number}> {
    return boxes.map(box => ({
      x: box.x * width,
      y: box.y * height,
      width: box.width * width,
      height: box.height * height,
    }))
  }

  /**
   * Health check - verify SAM API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple check: list available models
      await this.client.models.get(this.config.model.split('/')[0], this.config.model.split('/')[1])
      return true
    } catch (error) {
      console.error('[SAM] Health check failed:', error)
      return false
    }
  }
}
