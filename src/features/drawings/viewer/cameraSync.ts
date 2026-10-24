/**
 * Keeps the cameras of several viewers together (requirement CMP-01). A viewer publishes where its camera looks from
 * as a direction and a distance relative to its own default distance, so drawings of different sizes stay comparable.
 */
export interface CameraPose {
  /** Unit vector from the target to the camera. */
  direction: [number, number, number]
  /** Distance from the target in units of the viewer's default distance. */
  zoom: number
}

type Listener = (source: string, pose: CameraPose) => void

export interface CameraSync {
  publish(source: string, pose: CameraPose): void
  subscribe(listener: Listener): () => void
}

export function createCameraSync(): CameraSync {
  const listeners = new Set<Listener>()
  return {
    publish(source, pose) {
      listeners.forEach((listener) => listener(source, pose))
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
