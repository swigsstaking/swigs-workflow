import { TOPO_DATA_URI } from '../../utils/topoTexture';

/**
 * Absolute overlay that renders the SWIGS topographic texture.
 * Place inside a `relative overflow-hidden` parent.
 */
export default function TopoOverlay({ opacity = 0.03, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none select-none ${className}`}
      style={{
        backgroundImage: TOPO_DATA_URI,
        backgroundRepeat: 'repeat',
        backgroundSize: '400px 300px',
        opacity,
      }}
    />
  );
}
