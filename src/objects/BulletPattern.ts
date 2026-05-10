export interface BulletConfig {
  angle: number;
  speed: number;
}

export function spiral(
  arms: number,
  speed: number,
  rotationOffset = 0,
): BulletConfig[] {
  const configs: BulletConfig[] = [];
  const step = (Math.PI * 2) / arms;
  for (let i = 0; i < arms; i++) {
    configs.push({ angle: step * i + rotationOffset, speed });
  }
  return configs;
}

export function radial(count: number, speed: number): BulletConfig[] {
  return spiral(count, speed);
}

export function aimed(
  targetAngle: number,
  count: number,
  spread: number,
  speed: number,
): BulletConfig[] {
  if (count === 1) return [{ angle: targetAngle, speed }];
  const halfSpread = spread / 2;
  const step = spread / (count - 1);
  const configs: BulletConfig[] = [];
  for (let i = 0; i < count; i++) {
    configs.push({ angle: targetAngle - halfSpread + step * i, speed });
  }
  return configs;
}
