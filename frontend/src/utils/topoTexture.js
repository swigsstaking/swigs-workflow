/**
 * SWIGS Brand — Topographic Texture
 * Repeating SVG pattern of alpine contour lines (elliptic peaks).
 * Used as a subtle overlay on cards, headers, modals, sidebars.
 */

const TOPO_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'>
  <ellipse cx='200' cy='150' rx='190' ry='128' fill='none' stroke='rgb(200,195,188)' stroke-width='1.2'/>
  <ellipse cx='200' cy='150' rx='158' ry='106' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='200' cy='150' rx='124' ry='84' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='200' cy='150' rx='90' ry='61' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='200' cy='150' rx='58' ry='39' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='200' cy='150' rx='28' ry='19' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='55' cy='285' rx='86' ry='62' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='55' cy='285' rx='60' ry='43' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='55' cy='285' rx='36' ry='26' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='55' cy='285' rx='16' ry='12' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='370' cy='30' rx='84' ry='56' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='370' cy='30' rx='58' ry='38' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='370' cy='30' rx='34' ry='22' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
  <ellipse cx='370' cy='30' rx='14' ry='10' fill='none' stroke='rgb(200,195,188)' stroke-width='1'/>
</svg>`;

export const TOPO_DATA_URI = `url("data:image/svg+xml,${encodeURIComponent(TOPO_SVG)}")`;

/** Returns inline style object for the topo background at a given opacity. */
export const topoStyle = (opacity = 0.03) => ({
  backgroundImage: TOPO_DATA_URI,
  backgroundRepeat: 'repeat',
  backgroundSize: '400px 300px',
  opacity,
});
