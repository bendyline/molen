// Import first in an asset generator, or pass as `node --import`: Math's CPU-dependent functions
// become deterministic-math.mjs's ports here and, through NODE_OPTIONS, in child Node processes.
import { installDeterministicMath } from './deterministic-math.mjs';

installDeterministicMath();
const flag = `--import=${import.meta.url}`;
if (!(process.env.NODE_OPTIONS ?? '').split(' ').includes(flag))
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} ${flag}`.trim();
