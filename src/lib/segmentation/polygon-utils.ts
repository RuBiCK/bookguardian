// ============================================================================
// POLYGON UTILITIES
// ============================================================================

export interface Point {
  x: number
  y: number
}

/**
 * Simplify polygon using Ramer-Douglas-Peucker algorithm
 * Reduces number of points while preserving shape
 *
 * @param points - Array of polygon points
 * @param tolerance - Simplification tolerance (higher = more aggressive, 0.01 recommended)
 * @returns Simplified array of points
 */
export function simplifyPolygon(points: Point[], tolerance: number = 0.01): Point[] {
  if (points.length <= 3) return points

  // Find the point with the maximum distance from the line segment
  let maxDistance = 0
  let maxIndex = 0
  const end = points.length - 1

  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[end])
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = i
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    // Recursive call on the first part
    const firstPart = simplifyPolygon(points.slice(0, maxIndex + 1), tolerance)
    // Recursive call on the second part
    const secondPart = simplifyPolygon(points.slice(maxIndex), tolerance)

    // Concatenate the results (removing duplicate point at maxIndex)
    return [...firstPart.slice(0, -1), ...secondPart]
  } else {
    // If max distance is within tolerance, return endpoints
    return [points[0], points[end]]
  }
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y

  // Handle degenerate case where line start equals line end
  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    )
  }

  // Calculate perpendicular distance
  const numerator = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  )
  const denominator = Math.sqrt(dx * dx + dy * dy)

  return numerator / denominator
}

/**
 * Validate polygon data
 * Checks: minimum points, no NaN values, coordinates in valid range
 *
 * @param points - Array of polygon points
 * @param normalized - If true, expects coordinates in 0-1 range
 * @returns True if polygon is valid
 */
export function validatePolygon(points: Point[], normalized: boolean = true): boolean {
  // Must have at least 3 points to form a polygon
  if (points.length < 3) {
    return false
  }

  // Check each point
  for (const point of points) {
    // Check for NaN or undefined
    if (
      typeof point.x !== 'number' ||
      typeof point.y !== 'number' ||
      isNaN(point.x) ||
      isNaN(point.y)
    ) {
      return false
    }

    // If normalized, check bounds
    if (normalized) {
      if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
        return false
      }
    }
  }

  return true
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 *
 * @param point - Point to test
 * @param polygon - Array of polygon points
 * @returns True if point is inside polygon
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false

  let inside = false
  const {x, y} = point

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Normalize polygon coordinates from absolute pixels to 0-1 range
 *
 * @param points - Array of points in pixel coordinates
 * @param imageWidth - Image width in pixels
 * @param imageHeight - Image height in pixels
 * @returns Normalized points
 */
export function normalizePolygon(
  points: Point[],
  imageWidth: number,
  imageHeight: number
): Point[] {
  return points.map(point => ({
    x: point.x / imageWidth,
    y: point.y / imageHeight,
  }))
}

/**
 * Denormalize polygon coordinates from 0-1 range to absolute pixels
 *
 * @param points - Array of normalized points (0-1)
 * @param imageWidth - Image width in pixels
 * @param imageHeight - Image height in pixels
 * @returns Points in pixel coordinates
 */
export function denormalizePolygon(
  points: Point[],
  imageWidth: number,
  imageHeight: number
): Point[] {
  return points.map(point => ({
    x: point.x * imageWidth,
    y: point.y * imageHeight,
  }))
}

/**
 * Calculate the bounding box of a polygon
 *
 * @param points - Array of polygon points
 * @returns Bounding box {x, y, width, height}
 */
export function getPolygonBounds(points: Point[]): {
  x: number
  y: number
  width: number
  height: number
} {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}
