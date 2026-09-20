import { useState } from 'react';
import { initialOf } from '../lib/format';

interface AvatarProps {
  name: string;
  src: string | null;
  size?: number;
}

/** Round profile picture, or the person's initial on the accent colour. */
export function Avatar({ name, src, size = 48 }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (src && !failed) {
    return (
      <img
        className="avatar"
        src={src}
        alt=""
        width={size}
        height={size}
        style={style}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        data-testid="avatar-image"
      />
    );
  }
  return (
    <span
      className="avatar avatar--initial"
      style={style}
      aria-hidden="true"
      data-testid="avatar-initial"
    >
      {initialOf(name)}
    </span>
  );
}
