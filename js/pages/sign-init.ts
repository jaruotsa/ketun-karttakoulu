import * as FoxSvg from '../fox-svg';
import { $ } from '../dom';

$('#hint-fox').innerHTML = FoxSvg.svg();
FoxSvg.glance($<SVGSVGElement>('#hint-fox .fox'), 5000);
