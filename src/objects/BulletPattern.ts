export interface BulletConfig {
  angle: number;
  speed: number;
}

export function radial(count: number, speed: number): BulletConfig[] {
  const configs: BulletConfig[] = [];
  const step = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    configs.push({ angle: step * i, speed });
  }
  return configs;
}

export function aimed(
  targetAngle: number,
  count: number,
  spread: number,
  speed: number,
): BulletConfig[] {
  const configs: BulletConfig[] = [];
  if (count === 1) return [{ angle: targetAngle, speed }];
  const halfSpread = spread / 2;
  const step = spread / (count - 1);
  for (let i = 0; i < count; i++) {
    configs.push({ angle: targetAngle - halfSpread + step * i, speed });
  }
  return configs;
}

export function spiral(
  arms: number,
  speed: number,
  rotationOffset: number,
): BulletConfig[] {
  const configs: BulletConfig[] = [];
  const step = (Math.PI * 2) / arms;
  for (let i = 0; i < arms; i++) {
    configs.push({ angle: step * i + rotationOffset, speed });
  }
  return configs;
}
