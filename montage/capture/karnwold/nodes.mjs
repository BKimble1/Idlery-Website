// Compute where the build workbench's open connector nodes appear on screen, using the app's own
// (read-only) build-graph + placement modules and the workbench's fixed camera, so the recorded drag
// can release each piece exactly on a node instead of probing. Prints drop points as JSON.
import fs from 'node:fs';
// The Karnwold checkout this reads its build graph from (KARNWOLD_REPO, default: a sibling folder).
import { resolve as _resolve } from 'node:path';
import { pathToFileURL as _url } from 'node:url';
const KARNWOLD_REPO = process.env.KARNWOLD_REPO || '../karnwold';
const _k = (p) => _url(_resolve(KARNWOLD_REPO, p)).href;
const THREE = await import(_k('node_modules/three/build/three.module.js'));
const { setConnectorData, createBuild, openConnectors, connectorsOf, addPiece } = await import(_k('src/scene/buildGraph.js'));
const { bestPlacement } = await import(_k('src/scene/placement.js'));

const M = JSON.parse(fs.readFileSync(_resolve(KARNWOLD_REPO, 'public/models/manifest.json'), 'utf8'));
setConnectorData(JSON.parse(fs.readFileSync(_resolve(KARNWOLD_REPO, 'public/models/connectors.json'), 'utf8')));
const MM = 2.5 / (207.09 / 2); // MM_TO_SCENE (VillageCenter.jsx)
const FREE_CLAMP_MM = 160;
const box = JSON.parse(process.argv[2] || '{"x":461,"y":181,"width":998,"height":718}');
const sizes = Object.fromEntries(Object.entries(M).map(([t, e]) => [t, e.bbox.size]));
const cam = new THREE.PerspectiveCamera(38, box.width / box.height, 0.1, 1000);
cam.position.set(0.7, 0.6, 0.85); cam.lookAt(0, 0.18, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();

let graph = createBuild('block');
const lift = (M[graph.pieces[graph.root].type].bbox.size[1] / 2) * MM;
const toScreen = (p) => { const v = new THREE.Vector3(p[0] * MM, p[1] * MM + lift, p[2] * MM).project(cam); return [box.x + (v.x * 0.5 + 0.5) * box.width, box.y + (-v.y * 0.5 + 0.5) * box.height]; };
const freeAt = (sx, sy) => {
  const ndc = new THREE.Vector2(((sx - box.x) / box.width) * 2 - 1, -((sy - box.y) / box.height) * 2 + 1);
  const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, cam);
  const n = new THREE.Vector3(); cam.getWorldDirection(n);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(0, lift, 0));
  const hit = rc.ray.intersectPlane(plane, new THREE.Vector3());
  return hit ? new THREE.Vector3(hit.x / MM, (hit.y - lift) / MM, hit.z / MM).clampScalar(-FREE_CLAMP_MM, FREE_CLAMP_MM) : null;
};
const out = {};
for (const piece of ['arch', 'roof']) {
  const held = connectorsOf(piece);
  const cands = openConnectors(graph).filter((t) => held.some((c) => c.type !== t.type))
    .map((t) => ({ t, s: toScreen(t.pos) }))
    .sort((a, b) => a.s[1] - b.s[1]); // top-most node first
  let placed = false;
  for (const { t, s } of cands) {
    // the nearest-node rule: make sure no other compatible node is closer to this screen point
    const bp = bestPlacement(graph, piece, { pieceId: t.pieceId, connId: t.connId }, sizes, { aim: freeAt(s[0], s[1]) });
    if (!bp) continue;
    graph = addPiece(graph, piece, t.pieceId, t.connId, bp.heldConnId, bp.roll);
    out[piece] = [Math.round(s[0]), Math.round(s[1])];
    console.error(`${piece}: node ${t.pieceId}.${t.connId} (${t.type}) at screen ${out[piece]}; ${cands.length} candidates`);
    placed = true; break;
  }
  if (!placed) throw new Error('no valid node for ' + piece);
}
console.log(JSON.stringify(out));
