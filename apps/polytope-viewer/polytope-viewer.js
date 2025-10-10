/**
 * 3D Polytope Viewer Web Component (Raw WebGL2)
 * Lightweight viewer using raw WebGL2 instead of THREE.js
 */
class PolytopeViewer extends HTMLElement {
    // Static cached QuickHull module (shared across all instances)
    static _cachedQuickHull = null;
    static _quickHullLoadPromise = null;

    static get observedAttributes() {
        return ['vertices', 'wireframe', 'opacity'];
    }

    constructor() {
        super();

        // State
        this.vertices = null;
        this.isWireframe = false;
        this.faceOpacity = 0.9;
        this.currentPolytopeName = 'Permutahedron';

        // WebGL objects
        this.gl = null;
        this.prog = null;
        this.vao = null;
        this.wireframeVao = null;
        this.geometry = null;

        // WebGL buffers (tracked for cleanup)
        this.posBuf = null;
        this.colBuf = null;
        this.normalBuf = null;
        this.idxBuf = null;

        // Camera state (spherical coordinates)
        this.spherical = {
            radius: 8,
            theta: Math.PI / 4,
            phi: Math.PI / 3
        };

        this.sphericalDelta = {
            radius: 1
        };

        // Mouse/touch interaction
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.lastTime = 0;
        this.velocityTheta = 0;
        this.velocityPhi = 0;
        this.touchStartDist = 0;

        // Animation
        this.animationId = null;
        this._ro = null;

        // QuickHull (will reference static cached module)
        this.qh = null;
    }

    connectedCallback() {
        // Create container
        const container = document.createElement('div');
        container.style.cssText = `
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
            background: transparent;
        `;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.id = 'gl';
        canvas.style.cssText = `
            width: 100%;
            height: 100%;
            display: block;
            cursor: grab;
        `;

        container.appendChild(canvas);
        this.innerHTML = '';
        this.appendChild(container);

        this.parseAttributes();

        // Initialize in next frame
        requestAnimationFrame(() => {
            this.initialize().catch(err => {
                // Initialization error
            });
        });
    }

    disconnectedCallback() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this._ro) {
            this._ro.disconnect();
        }

        this.cleanup();
    }

    attributeChangedCallback(name, _oldValue, newValue) {
        if (name === 'wireframe') {
            this.isWireframe = newValue === 'true';
            this.updateEdgeColors();
        } else if (name === 'vertices') {
            this.parseVertices(newValue);
            if (this.gl) this.rebuildGeometry();
        } else if (name === 'opacity') {
            this.faceOpacity = this.parseOpacity(newValue);
        }
    }

    parseAttributes() {
        this.parseVertices(this.getAttribute('vertices'));
        this.isWireframe = this.getAttribute('wireframe') === 'true';
        this.faceOpacity = this.parseOpacity(this.getAttribute('opacity'));
    }

    parseVertices(attr) {
        if (!attr) {
            this.vertices = this.getDefaultPermutahedronVertices();
            return;
        }

        try {
            this.vertices = JSON.parse(attr);
        } catch (error) {
            this.vertices = this.getDefaultPermutahedronVertices();
        }
    }

    parseOpacity(val) {
        if (val === null || val === undefined || val === '') return 0.9;
        const num = Number(val);
        if (!isFinite(num)) return 0.9;
        return Math.min(1, Math.max(0, num));
    }

    async initialize() {
        await this.loadQuickHull();
        this.setupWebGL();
        this.setupShaders();
        this.rebuildGeometry();
        this.setupEventListeners();
        this.setupResizeObserver();
        this.startAnimationLoop();
    }

    async loadQuickHull() {
        // Return cached module if already loaded
        if (PolytopeViewer._cachedQuickHull) {
            this.qh = PolytopeViewer._cachedQuickHull;
            return;
        }

        // If already loading, wait for that promise
        if (PolytopeViewer._quickHullLoadPromise) {
            await PolytopeViewer._quickHullLoadPromise;
            this.qh = PolytopeViewer._cachedQuickHull;
            return;
        }

        // Start loading and cache the promise
        PolytopeViewer._quickHullLoadPromise = (async () => {
            // Inline QuickHull code (from index.html)
            const quickhullCode = `var e={824:(e,t,n)=>{var r=n(785),i=n(220),o=n(594),s=[0,0,0];e.exports=function(e,t,n,a){return i(e,t,n),i(s,n,a),o(e,e,s),r(e,e)}},434:e=>{e.exports=function(e,t,n){var r=t[0],i=t[1],o=t[2],s=t[3],a=r+r,c=i+i,l=o+o,h=r*a,p=r*c,u=r*l,d=i*c,f=i*l,v=o*l,x=s*a,g=s*c,m=s*l;return e[0]=1-(d+v),e[1]=p+m,e[2]=u-g,e[3]=0,e[4]=p-m,e[5]=1-(h+v),e[6]=f+x,e[7]=0,e[8]=u+g,e[9]=f-x,e[10]=1-(h+d),e[11]=0,e[12]=n[0],e[13]=n[1],e[14]=n[2],e[15]=1,e}},13:(e,t,n)=>{e.exports=n(496)},895:(e,t,n)=>{var r=n(409),i=n(594),o=n(136),s=n(785),a=n(13),c=n(236);e.exports=function(e,t,n){var u=r(t,n);return u<-.999999?(i(l,h,t),o(l)<1e-6&&i(l,p,t),s(l,l),c(e,l,Math.PI),e):u>.999999?(e[0]=0,e[1]=0,e[2]=0,e[3]=1,e):(i(l,t,n),e[0]=l[0],e[1]=l[1],e[2]=l[2],e[3]=1+u,a(e,e))};var l=[0,0,0],h=[1,0,0],p=[0,1,0]},236:e=>{e.exports=function(e,t,n){n*=.5;var r=Math.sin(n);return e[0]=r*t[0],e[1]=r*t[1],e[2]=r*t[2],e[3]=Math.cos(n),e}},401:e=>{e.exports=function(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e[2]=t[2]+n[2],e}},589:e=>{e.exports=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e}},594:e=>{e.exports=function(e,t,n){var r=t[0],i=t[1],o=t[2],s=n[0],a=n[1],c=n[2];return e[0]=i*c-o*a,e[1]=o*s-r*c,e[2]=r*a-i*s,e}},51:e=>{e.exports=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2];return Math.sqrt(n*n+r*r+i*i)}},409:e=>{e.exports=function(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}},136:e=>{e.exports=function(e){var t=e[0],n=e[1],r=e[2];return Math.sqrt(t*t+n*n+r*r)}},785:e=>{e.exports=function(e,t){var n=t[0],r=t[1],i=t[2],o=n*n+r*r+i*i;return o>0&&(o=1/Math.sqrt(o),e[0]=t[0]*o,e[1]=t[1]*o,e[2]=t[2]*o),e}},544:e=>{e.exports=function(e,t,n){return e[0]=t[0]*n,e[1]=t[1]*n,e[2]=t[2]*n,e}},252:e=>{e.exports=function(e,t,n,r){return e[0]=t[0]+n[0]*r,e[1]=t[1]+n[1]*r,e[2]=t[2]+n[2]*r,e}},312:e=>{e.exports=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2];return n*n+r*r+i*i}},59:e=>{e.exports=function(e){var t=e[0],n=e[1],r=e[2];return t*t+n*n+r*r}},220:e=>{e.exports=function(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e[2]=t[2]-n[2],e}},633:e=>{e.exports=function(e,t,n,r){var i=new Float32Array(4);return i[0]=e,i[1]=t,i[2]=n,i[3]=r,i}},496:e=>{e.exports=function(e,t){var n=t[0],r=t[1],i=t[2],o=t[3],s=n*n+r*r+i*i+o*o;return s>0&&(s=1/Math.sqrt(s),e[0]=n*s,e[1]=r*s,e[2]=i*s,e[3]=o*s),e}},897:e=>{e.exports=function(e,t,n){var r=t[0],i=t[1],o=t[2],s=t[3];return e[0]=n[0]*r+n[4]*i+n[8]*o+n[12]*s,e[1]=n[1]*r+n[5]*i+n[9]*o+n[13]*s,e[2]=n[2]*r+n[6]*i+n[10]*o+n[14]*s,e[3]=n[3]*r+n[7]*i+n[11]*o+n[15]*s,e}},291:(e,t,n)=>{e.exports=function(e){var t=e.length;if(t<3){for(var n=new Array(t),i=0;i<t;++i)n[i]=i;return 2===t&&e[0][0]===e[1][0]&&e[0][1]===e[1][1]?[0]:n}var o=new Array(t);for(i=0;i<t;++i)o[i]=i;o.sort((function(t,n){return e[t][0]-e[n][0]||e[t][1]-e[n][1]}));var s=[o[0],o[1]],a=[o[0],o[1]];for(i=2;i<t;++i){for(var c=o[i],l=e[c],h=s.length;h>1&&r(e[s[h-2]],e[s[h-1]],l)<=0;)h-=1,s.pop();for(s.push(c),h=a.length;h>1&&r(e[a[h-2]],e[a[h-1]],l)>=0;)h-=1,a.pop();a.push(c)}n=new Array(a.length+s.length-2);for(var p=0,u=(i=0,s.length);i<u;++i)n[p++]=s[i];for(var d=a.length-2;d>0;--d)n[p++]=a[d];return n};var r=n(573)[3]},106:(e,t,n)=>{var r=n(903);e.exports=function(e,t,n){return Math.sqrt(r(e,t,n))}},903:(e,t,n)=>{var r=n(220),i=n(594),o=n(59),s=[],a=[],c=[];e.exports=function(e,t,n){r(s,n,t),r(a,e,t);var l=o(i(c,a,s)),h=o(s);if(0===h)throw Error("a and b are the same point");return l/h}},573:(e,t,n)=>{var r=n(383),i=n(951),o=n(297),s=n(916);function a(e,t,n,r){return function(n,i,o){var s=e(e(t(i[1],o[0]),t(-o[1],i[0])),e(t(n[1],i[0]),t(-i[1],n[0]))),a=e(t(n[1],o[0]),t(-o[1],n[0])),c=r(s,a);return c[c.length-1]}}function c(e,t,n,r){return function(i,o,s,a){var c=e(e(n(e(t(s[1],a[0]),t(-a[1],s[0])),o[2]),e(n(e(t(o[1],a[0]),t(-a[1],o[0])),-s[2]),n(e(t(o[1],s[0]),t(-s[1],o[0])),a[2]))),e(n(e(t(o[1],a[0]),t(-a[1],o[0])),i[2]),e(n(e(t(i[1],a[0]),t(-a[1],i[0])),-o[2]),n(e(t(i[1],o[0]),t(-o[1],i[0])),a[2])))),l=e(e(n(e(t(s[1],a[0]),t(-a[1],s[0])),i[2]),e(n(e(t(i[1],a[0]),t(-a[1],i[0])),-s[2]),n(e(t(i[1],s[0]),t(-s[1],i[0])),a[2]))),e(n(e(t(o[1],s[0]),t(-s[1],o[0])),i[2]),e(n(e(t(i[1],s[0]),t(-s[1],i[0])),-o[2]),n(e(t(i[1],o[0]),t(-o[1],i[0])),s[2])))),h=r(c,l);return h[h.length-1]}}function l(e,t,n,r){return function(i,o,s,a,c){var l=e(e(e(n(e(n(e(t(a[1],c[0]),t(-c[1],a[0])),s[2]),e(n(e(t(s[1],c[0]),t(-c[1],s[0])),-a[2]),n(e(t(s[1],a[0]),t(-a[1],s[0])),c[2]))),o[3]),e(n(e(n(e(t(a[1],c[0]),t(-c[1],a[0])),o[2]),e(n(e(t(o[1],c[0]),t(-c[1],o[0])),-a[2]),n(e(t(o[1],a[0]),t(-a[1],o[0])),c[2]))),-s[3]),n(e(n(e(t(s[1],c[0]),t(-c[1],s[0])),o[2]),e(n(e(t(o[1],c[0]),t(-c[1],o[0])),-s[2]),n(e(t(o[1],s[0]),t(-s[1],o[0])),c[2]))),a[3]))),e(n(e(n(e(t(s[1],a[0]),t(-a[1],s[0])),o[2]),e(n(e(t(o[1],a[0]),t(-a[1],o[0])),-s[2]),n(e(t(o[1],s[0]),t(-s[1],o[0])),a[2]))),-c[3]),e(n(e(n(e(t(a[1],c[0]),t(-c[1],a[0])),o[2]),e(n(e(t(o[1],c[0]),t(-c[1],o[0])),-a[2]),n(e(t(o[1],a[0]),t(-a[1],o[0])),c[2]))),i[3]),n(e(n(e(t(a[1],c[0]),t(-c[1],a[0])),i[2]),e(n(e(t(i[1],c[0]),t(-c[1],i[0])),-a[2]),n(e(t(i[1],a[0]),t(-a[1],i[0])),c[2]))),-o[3])))),e(e(n(e(n(e(t(o[1],c[0]),t(-c[1],o[0])),i[2]),e(n(e(t(i[1],c[0]),t(-c[1],i[0])),-o[2]),n(e(t(i[1],o[0]),t(-o[1],i[0])),c[2]))),a[3]),e(n(e(n(e(t(o[1],a[0]),t(-a[1],o[0])),i[2]),e(n(e(t(i[1],a[0]),t(-a[1],i[0])),-o[2]),n(e(t(i[1],o[0]),t(-o[1],i[0])),a[2]))),-c[3]),n(e(n(e(t(s[1],a[0]),t(-a[1],s[0])),o[2]),e(n(e(t(o[1],a[0]),t(-a[1],o[0])),-s[2]),n(e(t(o[1],s[0]),t(-s[1],o[0])),a[2]))),i[3]))),e(n(e(n(e(t(s[1],a[0]),t(-a[1],s[0])),i[2]),e(n(e(t(i[1],a[0]),t(-a[1],i[0])),-s[2]),n(e(t(i[1],s[0]),t(-s[1],i[0])),a[2]))),-o[3]),e(n(e(n(e(t(o[1],a[0]),t(-a[1],o[0])),i[2]),e(n(e(t(i[1],a[0]),t(-a[1],i[0])),-o[2]),n(e(t(i[1],o[0]),t(-o[1],i[0])),a[2]))),s[3]),n(e(n(e(t(o[1],s[0]),t(-s[1],o[0])),i[2]),e(n(e(t(i[1],s[0]),t(-s[1],i[0])),-o[2]),n(e(t(i[1],o[0]),t(-o[1],i[0])),s[2]))),-a[3]))))),h=e(e(e(n(e(n(e(t(a[1],c[0]),t(-c[1],a[0])),s[2]),e(n(e(t(s[1],c[0]),t(-c[1],s[0])),-a[2]),n(e(t(s[1],a[0]),t(-a[1],s[0])),c[2]))),i[3]),n(e(n(e(t(a[1],c[0]),t(-c[1],a[0])),i[2]),e(n(e(t(i[1],c[0]),t(-c[1],i[0])),-a[2]),n(e(t(i[1],a[0]),t(-a[1],i[0])),c[2]))),-s[3])),e(n(e(n(e(t(s[1],c[0]),t(-c[1],s[0])),i[2]),e(n(e(t(i[1],c[0]),t(-c[1],i[0])),-s[2]),n(e(t(i[1],s[0]),t(-s[1],i[0])),c[2]))),a[3]),n(e(n(e(t(s[1],a[0]),t(-a[1],s[0])),i[2]),e(n(e(t(i[1],a[0]),t(-a[1],i[0])),-s[2]),n(e(t(i[1],s[0]),t(-s[1],i[0])),a[2]))),-c[3]))),e(e(n(e(n(e(t(s[1],c[0]),t(-c[1],s[0])),o[2]),e(n(e(t(o[1],c[0]),t(-c[1],o[0])),-s[2]),n(e(t(o[1],s[0]),t(-s[1],o[0])),c[2]))),i[3]),n(e(n(e(t(s[1],c[0]),t(-c[1],s[0])),i[2]),e(n(e(t(i[1],c[0]),t(-c[1],i[0])),-s[2]),n(e(t(i[1],s[0]),t(-s[1],i[0])),c[2]))),-o[3])),e(n(e(n(e(t(o[1],c[0]),t(-c[1],o[0])),i[2]),e(n(e(t(i[1],c[0]),t(-c[1],i[0])),-o[2]),n(e(t(i[1],o[0]),t(-o[1],i[0])),c[2]))),s[3]),n(e(n(e(t(o[1],s[0]),t(-s[1],o[0])),i[2]),e(n(e(t(i[1],s[0]),t(-s[1],i[0])),-o[2]),n(e(t(i[1],o[0]),t(-o[1],i[0])),s[2]))),-c[3])))),p=r(l,h);return p[p.length-1]}}function h(e){return(3===e?a:4===e?c:l)(i,r,o,s)}var p=h(3),u=h(4),d=[function(){return 0},function(){return 0},function(e,t){return t[0]-e[0]},function(e,t,n){var r,i=(e[1]-n[1])*(t[0]-n[0]),o=(e[0]-n[0])*(t[1]-n[1]),s=i-o;if(i>0){if(o<=0)return s;r=i+o}else{if(!(i<0))return s;if(o>=0)return s;r=-(i+o)}var a=33306690738754716e-32*r;return s>=a||s<=-a?s:p(e,t,n)},function(e,t,n,r){var i=e[0]-r[0],o=t[0]-r[0],s=n[0]-r[0],a=e[1]-r[1],c=t[1]-r[1],l=n[1]-r[1],h=e[2]-r[2],p=t[2]-r[2],d=n[2]-r[2],f=o*l,v=s*c,x=s*a,g=i*l,m=i*c,F=o*a,b=h*(f-v)+p*(x-g)+d*(m-F),w=7771561172376103e-31*((Math.abs(f)+Math.abs(v))*Math.abs(h)+(Math.abs(x)+Math.abs(g))*Math.abs(p)+(Math.abs(m)+Math.abs(F))*Math.abs(d));return b>w||-b>w?b:u(e,t,n,r)}];function f(e){var t=d[e.length];return t||(t=d[e.length]=h(e.length)),t.apply(void 0,e)}function v(e,t,n,r,i,o,s){return function(t,n,a,c,l){switch(arguments.length){case 0:case 1:return 0;case 2:return r(t,n);case 3:return i(t,n,a);case 4:return o(t,n,a,c);case 5:return s(t,n,a,c,l)}for(var h=new Array(arguments.length),p=0;p<arguments.length;++p)h[p]=arguments[p];return e(h)}}!function(){for(;d.length<=5;)d.push(h(d.length));e.exports=v.apply(void 0,[f].concat(d));for(var t=0;t<=5;++t)e.exports[t]=d[t]}()},297:(e,t,n)=>{var r=n(383),i=n(519);e.exports=function(e,t){var n=e.length;if(1===n){var o=r(e[0],t);return o[0]?o:[o[1]]}var s=new Array(2*n),a=[.1,.1],c=[.1,.1],l=0;r(e[0],t,a),a[0]&&(s[l++]=a[0]);for(var h=1;h<n;++h){r(e[h],t,c);var p=a[1];i(p,c[0],a),a[0]&&(s[l++]=a[0]);var u=c[1],d=a[1],f=u+d,v=d-(f-u);a[1]=f,v&&(s[l++]=v)}return a[1]&&(s[l++]=a[1]),0===l&&(s[l++]=0),s.length=l,s}},916:e=>{e.exports=function(e,t){var n=0|e.length,r=0|t.length;if(1===n&&1===r)return function(e,t){var n=e+t,r=n-e,i=e-(n-r)+(t-r);return i?[i,n]:[n]}(e[0],-t[0]);var i,o,s=new Array(n+r),a=0,c=0,l=0,h=Math.abs,p=e[c],u=h(p),d=-t[l],f=h(d);u<f?(o=p,(c+=1)<n&&(u=h(p=e[c]))):(o=d,(l+=1)<r&&(f=h(d=-t[l]))),c<n&&u<f||l>=r?(i=p,(c+=1)<n&&(u=h(p=e[c]))):(i=d,(l+=1)<r&&(f=h(d=-t[l])));for(var v,x,g=i+o,m=g-i,F=o-m,b=F,w=g;c<n&&l<r;)u<f?(i=p,(c+=1)<n&&(u=h(p=e[c]))):(i=d,(l+=1)<r&&(f=h(d=-t[l]))),(F=(o=b)-(m=(g=i+o)-i))&&(s[a++]=F),b=w-((v=w+g)-(x=v-w))+(g-x),w=v;for(;c<n;)(F=(o=b)-(m=(g=(i=p)+o)-i))&&(s[a++]=F),b=w-((v=w+g)-(x=v-w))+(g-x),w=v,(c+=1)<n&&(p=e[c]);for(;l<r;)(F=(o=b)-(m=(g=(i=d)+o)-i))&&(s[a++]=F),b=w-((v=w+g)-(x=v-w))+(g-x),w=v,(l+=1)<r&&(d=-t[l]);return b&&(s[a++]=b),w&&(s[a++]=w),a||(s[a++]=0),s.length=a,s}},951:e=>{e.exports=function(e,t){var n=0|e.length,r=0|t.length;if(1===n&&1===r)return function(e,t){var n=e+t,r=n-e,i=e-(n-r)+(t-r);return i?[i,n]:[n]}(e[0],t[0]);var i,o,s=new Array(n+r),a=0,c=0,l=0,h=Math.abs,p=e[c],u=h(p),d=t[l],f=h(d);u<f?(o=p,(c+=1)<n&&(u=h(p=e[c]))):(o=d,(l+=1)<r&&(f=h(d=t[l]))),c<n&&u<f||l>=r?(i=p,(c+=1)<n&&(u=h(p=e[c]))):(i=d,(l+=1)<r&&(f=h(d=t[l])));for(var v,x,g=i+o,m=g-i,F=o-m,b=F,w=g;c<n&&l<r;)u<f?(i=p,(c+=1)<n&&(u=h(p=e[c]))):(i=d,(l+=1)<r&&(f=h(d=t[l]))),(F=(o=b)-(m=(g=i+o)-i))&&(s[a++]=F),b=w-((v=w+g)-(x=v-w))+(g-x),w=v;for(;c<n;)(F=(o=b)-(m=(g=(i=p)+o)-i))&&(s[a++]=F),b=w-((v=w+g)-(x=v-w))+(g-x),w=v,(c+=1)<n&&(p=e[c]);for(;l<r;)(F=(o=b)-(m=(g=(i=d)+o)-i))&&(s[a++]=F),b=w-((v=w+g)-(x=v-w))+(g-x),w=v,(l+=1)<r&&(d=t[l]);return b&&(s[a++]=b),w&&(s[a++]=w),a||(s[a++]=0),s.length=a,s}},383:e=>{e.exports=function(e,n,r){var i=e*n,o=t*e,s=o-(o-e),a=e-s,c=t*n,l=c-(c-n),h=n-l,p=a*h-(i-s*l-a*l-s*h);return r?(r[0]=p,r[1]=i,r):[p,i]};var t=+(Math.pow(2,27)+1)},519:e=>{e.exports=function(e,t,n){var r=e+t,i=r-e,o=t-i,s=e-(r-i);return n?(n[0]=s+o,n[1]=r,n):[s+o,r]}}},t={};function n(r){var i=t[r];if(void 0!==i)return i.exports;var o=t[r]={exports:{}};return e[r](o,o.exports,n),o.exports}n.n=e=>{var t=e&&e.__esModule?()=>e.default:()=>e;return n.d(t,{a:t}),t},n.d=(e,t)=>{for(var r in t)n.o(t,r)&&!n.o(e,r)&&Object.defineProperty(e,r,{enumerable:!0,get:t[r]})},n.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t);var r={};n.d(r,{Z1:()=>K,Nz:()=>J,Ay:()=>X,_p:()=>Y});var i=n(824),o=n.n(i),s=n(106),a=n.n(s),c=n(291),l=n.n(c),h=n(409),p=n.n(h),u=n(544),d=n.n(u),f=n(633),v=n.n(f),x=n(897),g=n.n(x),m=n(434),F=n.n(m),b=n(895),w=n.n(b);function M(){function e(){}return e.enabled=!1,e}class A{head;tail;constructor(){this.head=null,this.tail=null}clear(){this.head=this.tail=null}insertBefore(e,t){t.prev=e.prev,t.next=e,t.prev?t.prev.next=t:this.head=t,e.prev=t}insertAfter(e,t){t.prev=e,t.next=e.next,t.next?t.next.prev=t:this.tail=t,e.next=t}add(e){this.head?this.tail.next=e:this.head=e,e.prev=this.tail,e.next=null,this.tail=e}addAll(e){for(this.head?this.tail.next=e:this.head=e,e.prev=this.tail;e.next;)e=e.next;this.tail=e}remove(e){e.prev?e.prev.next=e.next:this.head=e.next,e.next?e.next.prev=e.prev:this.tail=e.prev}removeChain(e,t){e.prev?e.prev.next=t.next:this.head=t.next,t.next?t.next.prev=e.prev:this.tail=e.prev}first(){return this.head}isEmpty(){return!this.head}}class V{point;index;next;prev;face;constructor(e,t){this.point=e,this.index=t,this.next=null,this.prev=null,this.face=null}}var T=n(401),N=n.n(T),E=n(220),y=n.n(E),C=n(594),P=n.n(C),k=n(589),O=n.n(k),j=n(136),H=n.n(j),I=n(252),D=n.n(I),q=n(785),$=n.n(q),z=n(51),L=n.n(z),S=n(312),B=n.n(S);const W=M();class _{vertex;face;next;prev;opposite;constructor(e,t){this.vertex=e,this.face=t,this.next=null,this.prev=null,this.opposite=null}head(){return this.vertex}tail(){return this.prev?this.prev.vertex:null}length(){return this.tail()?L()(this.tail().point,this.head().point):-1}lengthSquared(){return this.tail()?B()(this.tail().point,this.head().point):-1}setOpposite(e){const t=this;W.enabled&&W(\`opposite \${t.tail().index} <--\x3e \${t.head().index} between \${t.face.collectIndices()}, \${e.face.collectIndices()}\`),this.opposite=e,e.opposite=this}}const R=M();var Q;!function(e){e[e.Visible=0]="Visible",e[e.NonConvex=1]="NonConvex",e[e.Deleted=2]="Deleted"}(Q||(Q={}));class U{normal;centroid;offset;outside;mark;edge;nVertices;area;constructor(){this.normal=[0,0,0],this.centroid=[0,0,0],this.offset=0,this.outside=null,this.mark=Q.Visible,this.edge=null,this.nVertices=0}getEdge(e){let t=this.edge;for(;e>0;)t=t.next,e-=1;for(;e<0;)t=t.prev,e+=1;return t}computeNormal(){const e=this.edge,t=e.next;let n=t.next;const r=y()([],t.head().point,e.head().point),i=[],o=[];for(this.nVertices=2,this.normal=[0,0,0];n!==e;)O()(o,r),y()(r,n.head().point,e.head().point),N()(this.normal,this.normal,P()(i,o,r)),n=n.next,this.nVertices+=1;this.area=H()(this.normal),this.normal=d()(this.normal,this.normal,1/this.area)}computeNormalMinArea(e){if(this.computeNormal(),this.area<e){let e,t=0,n=this.edge;do{const r=n.lengthSquared();r>t&&(e=n,t=r),n=n.next}while(n!==this.edge);const r=e.tail().point,i=e.head().point,o=y()([],i,r),s=Math.sqrt(t);d()(o,o,1/s);const a=p()(this.normal,o);D()(this.normal,this.normal,o,-a),$()(this.normal,this.normal)}}computeCentroid(){this.centroid=[0,0,0];let e=this.edge;do{N()(this.centroid,this.centroid,e.head().point),e=e.next}while(e!==this.edge);d()(this.centroid,this.centroid,1/this.nVertices)}computeNormalAndCentroid(e){void 0!==e?this.computeNormalMinArea(e):this.computeNormal(),this.computeCentroid(),this.offset=p()(this.normal,this.centroid)}distanceToPlane(e){return p()(this.normal,e)-this.offset}connectHalfEdges(e,t){let n;if(e.opposite.face===t.opposite.face){const r=t.opposite.face;let i;e===this.edge&&(this.edge=t),3===r.nVertices?(i=t.opposite.prev.opposite,r.mark=Q.Deleted,n=r):(i=t.opposite.next,r.edge===i.prev&&(r.edge=i),i.prev=i.prev.prev,i.prev.next=i),t.prev=e.prev,t.prev.next=t,t.setOpposite(i),r.computeNormalAndCentroid()}else e.next=t,t.prev=e;return n}mergeAdjacentFaces(e,t){const n=e.opposite,r=n.face;t.push(r),r.mark=Q.Deleted;let i,o,s=e.prev,a=e.next,c=n.prev,l=n.next;for(;s.opposite.face===r;)s=s.prev,l=l.next;for(;a.opposite.face===r;)a=a.next,c=c.prev;for(i=l;i!==c.next;i=i.next)i.face=this;return this.edge=a,o=this.connectHalfEdges(c,a),o&&t.push(o),o=this.connectHalfEdges(s,l),o&&t.push(o),this.computeNormalAndCentroid(),t}collectIndices(){const e=[];let t=this.edge;do{e.push(t.head().index),t=t.next}while(t!==this.edge);return e}static fromVertices(e,t=0){const n=new U,r=new _(e[0],n);let i=r;for(let t=1;t<e.length;t+=1){const r=new _(e[t],n);r.prev=i,i.next=r,i=r}return i.next=r,r.prev=i,n.edge=r,n.computeNormalAndCentroid(t),R.enabled&&R("face created %j",n.collectIndices()),n}static createTriangle(e,t,n,r=0){const i=new U,o=new _(e,i),s=new _(t,i),a=new _(n,i);return o.next=a.prev=s,s.next=o.prev=a,a.next=s.prev=o,i.edge=o,i.computeNormalAndCentroid(r),R.enabled&&R("face created %j",i.collectIndices()),i}}const Z=M();var G;!function(e){e[e.NonConvexWrtLargerFace=0]="NonConvexWrtLargerFace",e[e.NonConvex=1]="NonConvex"}(G||(G={}));class J{skipTriangulation}class K{tolerance;faces;newFaces;claimed;unclaimed;vertices;discardedFaces;vertexPointIndices;constructor(e){if(!Array.isArray(e))throw TypeError("input is not a valid array");if(e.length<4)throw Error("cannot build a simplex out of <4 points");this.tolerance=-1,this.faces=[],this.newFaces=[],this.claimed=new A,this.unclaimed=new A,this.vertices=[];for(let t=0;t<e.length;t+=1)this.vertices.push(new V(e[t],t));this.discardedFaces=[],this.vertexPointIndices=[]}addVertexToFace(e,t){e.face=t,t.outside?this.claimed.insertBefore(t.outside,e):this.claimed.add(e),t.outside=e}removeVertexFromFace(e,t){e===t.outside&&(e.next&&e.next.face===t?t.outside=e.next:t.outside=null),this.claimed.remove(e)}removeAllVerticesFromFace(e){if(e.outside){let t=e.outside;for(;t.next&&t.next.face===e;)t=t.next;return this.claimed.removeChain(e.outside,t),t.next=null,e.outside}}deleteFaceVertices(e,t){const n=this.removeAllVerticesFromFace(e);if(n)if(t){let e;for(let r=n;r;r=e)e=r.next,t.distanceToPlane(r.point)>this.tolerance?this.addVertexToFace(r,t):this.unclaimed.add(r)}else this.unclaimed.addAll(n)}resolveUnclaimedPoints(e){let t=this.unclaimed.first();for(let n=t;n;n=t){t=n.next;let r,i=this.tolerance;for(let t=0;t<e.length;t+=1){const o=e[t];if(o.mark===Q.Visible){const e=o.distanceToPlane(n.point);if(e>i&&(i=e,r=o),i>1e3*this.tolerance)break}}r&&this.addVertexToFace(n,r)}}allPointsBelongToPlane(e,t,n){const r=o()([0,0,0],e.point,t.point,n.point),i=p()(r,e.point);for(const e of this.vertices){const t=p()(e.point,r);if(Math.abs(t-i)>this.tolerance)return!1}return!0}convexHull2d(e,t,n){const r=o()([0,0,0],e.point,t.point,n.point),i=w()([],r,[0,1,0]),s=d()([],r,-p()(e.point,r)),a=F()([],i,s),c=[];for(const e of this.vertices){const t=v()(e.point[0],e.point[1],e.point[2],0),n=g()([],t,a);Z.enabled&&n[1]>this.tolerance&&Z(\`ERROR: point \${n} has an unexpected y value, it should be less than \${this.tolerance}\`),c.push([n[0],n[2]])}const h=l()(c),u=[];for(const e of h)u.push(this.vertices[e]);const f=U.fromVertices(u);this.faces=[f]}computeTetrahedronExtremes(){const e=[],t=[],n=[],r=[];for(let e=0;e<3;e+=1)n[e]=r[e]=this.vertices[0];for(let n=0;n<3;n+=1)e[n]=t[n]=this.vertices[0].point[n];for(let i=1;i<this.vertices.length;i+=1){const o=this.vertices[i],s=o.point;for(let t=0;t<3;t+=1)s[t]<e[t]&&(e[t]=s[t],n[t]=o);for(let e=0;e<3;e+=1)s[e]>t[e]&&(t[e]=s[e],r[e]=o)}this.tolerance=3*Number.EPSILON*(Math.max(Math.abs(e[0]),Math.abs(t[0]))+Math.max(Math.abs(e[1]),Math.abs(t[1]))+Math.max(Math.abs(e[2]),Math.abs(t[2]))),Z.enabled&&Z("tolerance %d",this.tolerance);let i=0,s=0;for(let e=0;e<3;e+=1){const t=r[e].point[e]-n[e].point[e];t>i&&(i=t,s=e)}const c=n[s],l=r[s];let h,u;i=0;for(let e=0;e<this.vertices.length;e+=1){const t=this.vertices[e];if(t!==c&&t!==l){const e=a()(t.point,c.point,l.point);e>i&&(i=e,h=t)}}const d=o()([0,0,0],c.point,l.point,h.point),f=p()(c.point,d);i=-1;for(let e=0;e<this.vertices.length;e+=1){const t=this.vertices[e];if(t!==c&&t!==l&&t!==h){const e=Math.abs(p()(d,t.point)-f);e>i&&(i=e,u=t)}}return[c,l,h,u]}createInitialSimplex(e,t,n,r){const i=o()([0,0,0],e.point,t.point,n.point),s=p()(e.point,i),a=[];if(p()(r.point,i)-s<0){a.push(U.createTriangle(e,t,n),U.createTriangle(r,t,e),U.createTriangle(r,n,t),U.createTriangle(r,e,n));for(let e=0;e<3;e+=1){const t=(e+1)%3;a[e+1].getEdge(2).setOpposite(a[0].getEdge(t)),a[e+1].getEdge(1).setOpposite(a[t+1].getEdge(0))}}else{a.push(U.createTriangle(e,n,t),U.createTriangle(r,e,t),U.createTriangle(r,t,n),U.createTriangle(r,n,e));for(let e=0;e<3;e+=1){const t=(e+1)%3;a[e+1].getEdge(2).setOpposite(a[0].getEdge((3-e)%3)),a[e+1].getEdge(0).setOpposite(a[t+1].getEdge(1))}}for(let e=0;e<4;e+=1)this.faces.push(a[e]);const c=this.vertices;for(let i=0;i<c.length;i+=1){const o=c[i];if(o!==e&&o!==t&&o!==n&&o!==r){let e,t=this.tolerance;for(let n=0;n<4;n+=1){const r=a[n].distanceToPlane(o.point);r>t&&(t=r,e=a[n])}e&&this.addVertexToFace(o,e)}}}reindexFaceAndVertices(){const e=[];for(let t=0;t<this.faces.length;t+=1){const n=this.faces[t];n.mark===Q.Visible&&e.push(n)}this.faces=e}collectFaces(e){const t=[];for(let n=0;n<this.faces.length;n+=1){if(this.faces[n].mark!==Q.Visible)throw Error("attempt to include a destroyed face in the hull");const r=this.faces[n].collectIndices();if(e)t.push(r);else for(let e=0;e<r.length-2;e+=1)t.push([r[0],r[e+1],r[e+2]])}return t}nextVertexToAdd(){if(!this.claimed.isEmpty()){let e,t,n=0;const r=this.claimed.first().face;for(t=r.outside;t&&t.face===r;t=t.next){const i=r.distanceToPlane(t.point);i>n&&(n=i,e=t)}return e}}computeHorizon(e,t,n,r){let i;this.deleteFaceVertices(n),n.mark=Q.Deleted,i=t?t.next:t=n.getEdge(0);do{const t=i.opposite,n=t.face;n.mark===Q.Visible&&(n.distanceToPlane(e)>this.tolerance?this.computeHorizon(e,t,n,r):r.push(i)),i=i.next}while(i!==t)}addAdjoiningFace(e,t){const n=U.createTriangle(e,t.tail(),t.head());return this.faces.push(n),n.getEdge(-1).setOpposite(t.opposite),n.getEdge(0)}addNewFaces(e,t){let n,r;this.newFaces=[];for(let i=0;i<t.length;i+=1){const o=t[i],s=this.addAdjoiningFace(e,o);n?s.next.setOpposite(r):n=s,this.newFaces.push(s.face),r=s}n.next.setOpposite(r)}oppositeFaceDistance(e){return e.face.distanceToPlane(e.opposite.face.centroid)}doAdjacentMerge(e,t){let n=e.edge,r=!0,i=0;do{if(i>=e.nVertices)throw Error("merge recursion limit exceeded");const o=n.opposite.face;let s=!1;if(t===G.NonConvex?(this.oppositeFaceDistance(n)>-this.tolerance||this.oppositeFaceDistance(n.opposite)>-this.tolerance)&&(s=!0):e.area>o.area?this.oppositeFaceDistance(n)>-this.tolerance?s=!0:this.oppositeFaceDistance(n.opposite)>-this.tolerance&&(r=!1):this.oppositeFaceDistance(n.opposite)>-this.tolerance?s=!0:this.oppositeFaceDistance(n)>-this.tolerance&&(r=!1),s){Z("face merge");const t=e.mergeAdjacentFaces(n,[]);for(let n=0;n<t.length;n+=1)this.deleteFaceVertices(t[n],e);return!0}n=n.next,i+=1}while(n!==e.edge);return r||(e.mark=Q.NonConvex),!1}addVertexToHull(e){const t=[];this.unclaimed.clear(),this.removeVertexFromFace(e,e.face),this.computeHorizon(e.point,null,e.face,t),Z.enabled&&Z("horizon %j",t.map((function(e){return e.head().index}))),this.addNewFaces(e,t),Z("first merge");for(let e=0;e<this.newFaces.length;e+=1){const t=this.newFaces[e];if(t.mark===Q.Visible)for(;this.doAdjacentMerge(t,G.NonConvexWrtLargerFace););}Z("second merge");for(let e=0;e<this.newFaces.length;e+=1){const t=this.newFaces[e];if(t.mark===Q.NonConvex)for(t.mark=Q.Visible;this.doAdjacentMerge(t,G.NonConvexWrtLargerFace););}Z("reassigning points to newFaces"),this.resolveUnclaimedPoints(this.newFaces)}build(){let e,t=0;const[n,r,i,o]=this.computeTetrahedronExtremes();if(this.allPointsBelongToPlane(n,r,i))return this.convexHull2d(n,r,i),this;for(this.createInitialSimplex(n,r,i,o);e=this.nextVertexToAdd();)t+=1,Z(\`== iteration \${t} ==\`),Z("next vertex to add = %d %j",e.index,e.point),this.addVertexToHull(e),Z(\`== end iteration \${t}\`);return this.reindexFaceAndVertices(),this}}function X(e,t={}){const n=new K(e);return n.build(),n.collectFaces(t.skipTriangulation)}function Y(e,t,n){for(let r=0;r<n.length;r++){const i=n[r],s=t[i[0]],a=t[i[1]],c=t[i[2]],l=o()(new Float32Array(3),s,a,c),h=[e[0]-s[0],e[1]-s[1],e[2]-s[2]];if(l[0]*h[0]+l[1]*h[1]+l[2]*h[2]>0)return!1}return!0}var ee=r.Z1,te=r.Nz,ne=r.Ay,re=r._p;export{ee as QuickHull,te as QuickHullOptions,ne as default,re as isPointInsideHull};`;

            const blob = new Blob([quickhullCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const qhMod = await import(url);
            URL.revokeObjectURL(url);

            // Cache the module for all instances
            PolytopeViewer._cachedQuickHull = qhMod.default || qhMod;
        })();

        await PolytopeViewer._quickHullLoadPromise;
        this.qh = PolytopeViewer._cachedQuickHull;
    }

    setupWebGL() {
        const canvas = this.querySelector('#gl');
        this.gl = canvas.getContext('webgl2', { antialias: true, alpha: true });

        if (!this.gl) {
            throw new Error('WebGL2 not supported');
        }

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // Fully transparent background
    }

    setupShaders() {
        const gl = this.gl;

        const vs = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aCol;
layout(location=2) in vec3 aNormal;
uniform mat4 uMVP;
uniform mat4 uModel;
uniform mat4 uNormalMatrix;
out vec3 vCol;
out vec3 vNormal;
out vec3 vWorldPos;
void main(){
  vCol = aCol;
  vNormal = mat3(uNormalMatrix) * aNormal;
  vWorldPos = (uModel * vec4(aPos, 1.0)).xyz;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

        const fs = `#version 300 es
precision mediump float;
in vec3 vCol;
in vec3 vNormal;
in vec3 vWorldPos;
out vec4 fragColor;
uniform float uOpacity;
uniform vec3 uCameraPos;
void main(){
  vec3 normal = normalize(vNormal);
  vec3 ambient = vCol * 0.2;
  vec3 keyLightPos = vec3(6.0, 10.0, 8.0);
  vec3 keyLightDir = normalize(keyLightPos);
  float keyDiffuse = max(dot(normal, keyLightDir), 0.0);
  vec3 keyLight = vCol * keyDiffuse * 0.5;
  vec3 fillLightPos = vec3(-8.0, -4.0, 6.0);
  vec3 fillLightDir = normalize(fillLightPos);
  float fillDiffuse = max(dot(normal, fillLightDir), 0.0);
  vec3 fillLight = vCol * fillDiffuse * 0.25;
  vec3 viewDir = normalize(uCameraPos - vWorldPos);
  vec3 keyReflect = reflect(-keyLightDir, normal);
  float spec = pow(max(dot(viewDir, keyReflect), 0.0), 32.0) * 0.08;
  vec3 specular = vec3(spec);
  vec3 finalColor = ambient + keyLight + fillLight + specular;
  fragColor = vec4(finalColor, uOpacity);
}`;

        const compileShader = (type, src) => {
            const sh = gl.createShader(type);
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
                throw new Error(gl.getShaderInfoLog(sh) || 'Shader compile error');
            }
            return sh;
        };

        this.prog = gl.createProgram();
        gl.attachShader(this.prog, compileShader(gl.VERTEX_SHADER, vs));
        gl.attachShader(this.prog, compileShader(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(this.prog);

        if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(this.prog) || 'Program link error');
        }
    }

    setupEventListeners() {
        const canvas = this.querySelector('#gl');

        // Mouse events
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', () => this.handleMouseUp());
        canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // Touch events
        canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        canvas.addEventListener('touchend', () => this.handleTouchEnd());
    }

    handleMouseDown(e) {
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.lastTime = performance.now();
        this.velocityTheta = 0;
        this.velocityPhi = 0;
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;

        const currentTime = performance.now();
        const deltaTime = Math.max(1, currentTime - this.lastTime);

        const deltaX = e.clientX - this.lastX;
        const deltaY = e.clientY - this.lastY;

        const sensitivity = Math.PI / 450 * 0.5;
        const deltaTheta = -deltaX * sensitivity;
        const deltaPhi = -deltaY * sensitivity;

        this.spherical.theta += deltaTheta;
        this.spherical.phi += deltaPhi;
        this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi));

        this.velocityTheta = deltaTheta / deltaTime * 16;
        this.velocityPhi = deltaPhi / deltaTime * 16;

        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.lastTime = currentTime;
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    handleWheel(e) {
        e.preventDefault();
        const scale = Math.pow(0.95, Math.abs(e.deltaY * 0.01));
        if (e.deltaY < 0) {
            this.sphericalDelta.radius /= scale;
        } else {
            this.sphericalDelta.radius *= scale;
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touches = Array.from(e.touches);

        if (touches.length === 1) {
            this.isDragging = true;
            this.lastX = touches[0].clientX;
            this.lastY = touches[0].clientY;
            this.lastTime = performance.now();
            this.velocityTheta = 0;
            this.velocityPhi = 0;
        } else if (touches.length === 2) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            this.touchStartDist = Math.sqrt(dx * dx + dy * dy);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touches = Array.from(e.touches);

        if (touches.length === 1 && this.isDragging) {
            const currentTime = performance.now();
            const deltaTime = Math.max(1, currentTime - this.lastTime);

            const deltaX = touches[0].clientX - this.lastX;
            const deltaY = touches[0].clientY - this.lastY;

            const sensitivity = Math.PI / 450 * 0.5;
            const deltaTheta = -deltaX * sensitivity;
            const deltaPhi = -deltaY * sensitivity;

            this.spherical.theta += deltaTheta;
            this.spherical.phi += deltaPhi;
            this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi));

            this.velocityTheta = deltaTheta / deltaTime * 16;
            this.velocityPhi = deltaPhi / deltaTime * 16;

            this.lastX = touches[0].clientX;
            this.lastY = touches[0].clientY;
            this.lastTime = currentTime;
        } else if (touches.length === 2 && this.touchStartDist > 0) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (this.touchStartDist > 0) {
                const scale = this.touchStartDist / distance;
                this.sphericalDelta.radius *= scale;
                this.touchStartDist = distance;
            }
        }
    }

    handleTouchEnd() {
        this.isDragging = false;
        this.touchStartDist = 0;
    }

    setupResizeObserver() {
        const handleResize = () => {
            const canvas = this.querySelector('#gl');
            const { width, height } = this.getBoundingClientRect();
            if (!width || !height) return;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.floor(width * dpr);
            const h = Math.floor(height * dpr);

            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }

            this.gl.viewport(0, 0, canvas.width, canvas.height);

            // Re-frame the polytope when aspect ratio changes
            if (this.vertices && this.vertices.length > 0) {
                this.frameToFit();
            }
        };

        handleResize();
        this._ro = new ResizeObserver(handleResize);
        this._ro.observe(this);
    }

    rebuildGeometry() {
        // Dispose of old geometry resources first
        this.disposeGeometry();

        const faces = this.getFacesFromVertices(this.vertices);
        const edges = this.getEdgesFromFaces(faces);

        this.geometry = this.buildGeometry(this.vertices, faces, edges);
        this.setupVAOs();

        // Auto-frame the polytope after building geometry
        this.frameToFit();
    }

    /**
     * Update the polytope vertices and rebuild geometry
     * @param {Array<Array<number>>} vertices - Array of 3D vertex coordinates
     * @public
     */
    updateVertices(vertices) {
        if (!vertices || !Array.isArray(vertices)) {
            console.warn('Invalid vertices provided to updateVertices()');
            return;
        }

        this.vertices = vertices;

        // Only rebuild if WebGL is initialized
        if (this.gl) {
            this.rebuildGeometry();
        }
    }

    frameToFit() {
        if (!this.vertices || this.vertices.length === 0) return;

        // Calculate bounding box center
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (const vertex of this.vertices) {
            minX = Math.min(minX, vertex[0]);
            minY = Math.min(minY, vertex[1]);
            minZ = Math.min(minZ, vertex[2]);
            maxX = Math.max(maxX, vertex[0]);
            maxY = Math.max(maxY, vertex[1]);
            maxZ = Math.max(maxZ, vertex[2]);
        }

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;

        if (!isFinite(centerX + centerY + centerZ)) return;

        // Calculate max radius from center to any vertex
        let maxRadius = 0;
        for (const vertex of this.vertices) {
            const dx = vertex[0] - centerX;
            const dy = vertex[1] - centerY;
            const dz = vertex[2] - centerZ;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            maxRadius = Math.max(maxRadius, dist);
        }

        if (maxRadius === 0) maxRadius = 1;

        // Calculate camera distance based on FOV and aspect ratio
        const canvas = this.querySelector('#gl');
        const aspect = canvas ? Math.max(1e-6, canvas.width / canvas.height) : 1;
        const fov = 60 * (Math.PI / 180); // Same FOV as in render()

        // Calculate distance needed for both dimensions
        const verticalDistance = maxRadius / Math.tan(fov / 2);
        const horizontalDistance = maxRadius / (Math.tan(fov / 2) * aspect);

        // Use the maximum to ensure it fits in both dimensions
        const baseDistance = Math.max(verticalDistance, horizontalDistance);

        // Add padding (1.5x) to ensure polytope fits comfortably
        const paddingMultiplier = 1.5;
        const distance = baseDistance * paddingMultiplier;

        // Update spherical camera coordinates
        // Keep current angles but update radius to frame the polytope
        this.spherical.radius = distance;
    }

    getFacesFromVertices(vertices) {
        if (!vertices || vertices.length < 4) return [];
        try {
            const faces = this.qh(vertices, { skipTriangulation: true });
            return Array.isArray(faces) ? faces : [];
        } catch (e) {
            return [];
        }
    }

    getEdgesFromFaces(faces) {
        const edgeSet = new Set();

        faces.forEach(face => {
            if (!face || face.length < 3) return;
            const n = face.length;
            for (let i = 0; i < n; i++) {
                const a = face[i];
                const b = face[(i + 1) % n];
                const key = a < b ? `${a}-${b}` : `${b}-${a}`;
                edgeSet.add(key);
            }
        });

        return Array.from(edgeSet, key => {
            const [a, b] = key.split('-').map(Number);
            return [a, b];
        });
    }

    buildGeometry(vertices, faces, edges) {
        const faceColors = [
            '#FF5252', '#26E07F', '#4A90FF', '#FF8A33', '#D966FF',
            '#26C6DA', '#FFE657', '#F74980', '#90FF33', '#7C52FF',
            '#FF6347', '#33DEAF', '#FFBD47', '#CC4FE0', '#33B8FF'
        ];

        const positions = [];
        const colors = [];
        const normals = [];
        const indices = [];
        let indexOffset = 0;

        faces.forEach((face, faceIndex) => {
            if (!face || face.length < 3) return;

            const color = this.hexToRgb(faceColors[faceIndex % faceColors.length]);

            const v0 = vertices[face[0]];
            const v1 = vertices[face[1]];
            const v2 = vertices[face[2]];

            const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
            const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

            const nx = e1[1] * e2[2] - e1[2] * e2[1];
            const ny = e1[2] * e2[0] - e1[0] * e2[2];
            const nz = e1[0] * e2[1] - e1[1] * e2[0];

            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            const normal = len > 0 ? [nx / len, ny / len, nz / len] : [0, 0, 1];

            const faceStartIndex = indexOffset;
            face.forEach(vertexIndex => {
                const vertex = vertices[vertexIndex];
                positions.push(vertex[0], vertex[1], vertex[2]);
                colors.push(...color);
                normals.push(...normal);
                indexOffset++;
            });

            for (let i = 1; i < face.length - 1; i++) {
                indices.push(faceStartIndex, faceStartIndex + i, faceStartIndex + i + 1);
            }
        });

        // Add edges
        const edgeStartIndex = indexOffset;
        const blackColor = [0, 0, 0];
        const colorfulEdgeColors = [];
        const blackEdgeColors = [];

        edges.forEach(([a, b]) => {
            const randomColor = this.generateRandomColorfulRgb();

            positions.push(...vertices[a], ...vertices[b]);
            colors.push(...blackColor, ...blackColor);
            normals.push(0, 0, 1, 0, 0, 1);

            // Store both color options
            colorfulEdgeColors.push(...randomColor, ...randomColor);
            blackEdgeColors.push(...blackColor, ...blackColor);
        });

        return {
            positions: new Float32Array(positions),
            colors: new Float32Array(colors),
            normals: new Float32Array(normals),
            indices: new Uint16Array(indices),
            edgeStart: edgeStartIndex,
            edgeCount: edges.length * 2,
            colorfulEdgeColors: new Float32Array(colorfulEdgeColors),
            blackEdgeColors: new Float32Array(blackEdgeColors)
        };
    }

    updateEdgeColors() {
        if (!this.gl || !this.geometry || !this.colBuf) {
            return;
        }

        const gl = this.gl;
        const geom = this.geometry;

        // Choose edge colors based on wireframe mode
        const edgeColors = this.isWireframe ? geom.colorfulEdgeColors : geom.blackEdgeColors;

        // Update only the edge portion of the color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colBuf);
        gl.bufferSubData(
            gl.ARRAY_BUFFER,
            geom.edgeStart * 3 * 4, // offset in bytes (3 floats per vertex * 4 bytes per float)
            edgeColors
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    setupVAOs() {
        const gl = this.gl;
        const geom = this.geometry;

        // Main VAO
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        this.posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, geom.positions, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        // Store color buffer for later updates
        this.colBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colBuf);
        gl.bufferData(gl.ARRAY_BUFFER, geom.colors, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        this.normalBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuf);
        gl.bufferData(gl.ARRAY_BUFFER, geom.normals, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

        this.idxBuf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geom.indices, gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        // Set initial edge colors based on wireframe mode
        this.updateEdgeColors();
    }

    startAnimationLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.updateCamera();
            this.render();
        };
        animate();
    }

    updateCamera() {
        if (!this.isDragging) {
            this.spherical.theta += this.velocityTheta;
            this.spherical.phi += this.velocityPhi;
            this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi));

            this.velocityTheta *= 0.92;
            this.velocityPhi *= 0.92;

            if (Math.abs(this.velocityTheta) < 0.0001) this.velocityTheta = 0;
            if (Math.abs(this.velocityPhi) < 0.0001) this.velocityPhi = 0;
        }

        this.spherical.radius *= this.sphericalDelta.radius;
        this.sphericalDelta.radius = 1;
        this.spherical.radius = Math.max(1, Math.min(50, this.spherical.radius));
    }

    render() {
        const gl = this.gl;
        const canvas = this.querySelector('#gl');

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.prog);

        const aspect = Math.max(1e-6, canvas.width / canvas.height);
        const P = this.mat4Perspective(60 * Math.PI / 180, aspect, 0.01, 100.0);

        const camX = this.spherical.radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
        const camY = this.spherical.radius * Math.cos(this.spherical.phi);
        const camZ = this.spherical.radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
        const camPos = [camX, camY, camZ];

        const V = this.mat4LookAt(camPos, [0, 0, 0], [0, 1, 0]);
        const M = this.mat4Identity();
        const N = this.mat4Identity();
        const MVP = this.mat4Multiply(this.mat4Multiply(P, V), M);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uMVP'), false, MVP);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uModel'), false, M);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, 'uNormalMatrix'), false, N);
        gl.uniform3fv(gl.getUniformLocation(this.prog, 'uCameraPos'), camPos);

        gl.bindVertexArray(this.vao);

        if (this.isWireframe) {
            // Draw only edges in wireframe mode
            gl.uniform1f(gl.getUniformLocation(this.prog, 'uOpacity'), 1.0);
            gl.drawArrays(gl.LINES, this.geometry.edgeStart, this.geometry.edgeCount);
        } else {
            // Draw faces
            gl.uniform1f(gl.getUniformLocation(this.prog, 'uOpacity'), this.faceOpacity);
            gl.drawElements(gl.TRIANGLES, this.geometry.indices.length, gl.UNSIGNED_SHORT, 0);

            // Draw edges
            gl.uniform1f(gl.getUniformLocation(this.prog, 'uOpacity'), 1.0);
            gl.drawArrays(gl.LINES, this.geometry.edgeStart, this.geometry.edgeCount);
        }

        gl.bindVertexArray(null);
    }

    // Matrix math helpers
    mat4Identity() {
        return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    }

    mat4Multiply(a, b) {
        const o = new Float32Array(16);
        for (let c = 0; c < 4; c++) {
            for (let r = 0; r < 4; r++) {
                o[c * 4 + r] =
                    a[0 * 4 + r] * b[c * 4 + 0] +
                    a[1 * 4 + r] * b[c * 4 + 1] +
                    a[2 * 4 + r] * b[c * 4 + 2] +
                    a[3 * 4 + r] * b[c * 4 + 3];
            }
        }
        return o;
    }

    mat4Perspective(fovy, aspect, near, far) {
        const f = 1 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        const o = new Float32Array(16);
        o[0] = f / aspect;
        o[5] = f;
        o[10] = (far + near) * nf;
        o[11] = -1;
        o[14] = (2 * far * near) * nf;
        return o;
    }

    mat4LookAt(eye, target, up) {
        const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const cross = (a, b) => [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const normalize = (v) => {
            const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
            return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
        };

        const z = normalize(subtract(eye, target));
        const x = normalize(cross(up, z));
        const y = cross(z, x);

        return new Float32Array([
            x[0], y[0], z[0], 0,
            x[1], y[1], z[1], 0,
            x[2], y[2], z[2], 0,
            -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
        ]);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16) / 255,
            parseInt(result[2], 16) / 255,
            parseInt(result[3], 16) / 255
        ] : [1, 1, 1];
    }

    generateRandomColorfulRgb() {
        // Generate vibrant colors using HSL and converting to RGB
        const hue = Math.random() * 360;
        const saturation = 0.7 + Math.random() * 0.3; // 70-100% saturation
        const lightness = 0.5 + Math.random() * 0.2; // 50-70% lightness

        // Convert HSL to RGB
        const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
        const m = lightness - c / 2;

        let r, g, b;
        if (hue < 60) {
            [r, g, b] = [c, x, 0];
        } else if (hue < 120) {
            [r, g, b] = [x, c, 0];
        } else if (hue < 180) {
            [r, g, b] = [0, c, x];
        } else if (hue < 240) {
            [r, g, b] = [0, x, c];
        } else if (hue < 300) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }

        return [r + m, g + m, b + m];
    }

    getDefaultPermutahedronVertices() {
        return [
            [-2.121320343559642, -0.408248290463863,  0.577350269189626],
            [-2.121320343559642,  0.408248290463863, -0.577350269189626],
            [-1.414213562373095, -1.632993161855452,  0.577350269189626],
            [-1.414213562373095,  0.000000000000000, -1.732050807568877],
            [-1.414213562373095,  0.000000000000000,  1.732050807568877],
            [-1.414213562373095,  1.632993161855452, -0.577350269189626],
            [-0.707106781186548, -2.041241452319315, -0.577350269189626],
            [-0.707106781186548, -1.224744871391589, -1.732050807568877],
            [-0.707106781186548, -1.224744871391589,  1.732050807568877],
            [-0.707106781186548,  1.224744871391589, -1.732050807568877],
            [-0.707106781186548,  1.224744871391589,  1.732050807568877],
            [-0.707106781186548,  2.041241452319315,  0.577350269189626],
            [ 0.707106781186548, -2.041241452319315, -0.577350269189626],
            [ 0.707106781186548, -1.224744871391589, -1.732050807568877],
            [ 0.707106781186548, -1.224744871391589,  1.732050807568877],
            [ 0.707106781186548,  1.224744871391589, -1.732050807568877],
            [ 0.707106781186548,  1.224744871391589,  1.732050807568877],
            [ 0.707106781186548,  2.041241452319315,  0.577350269189626],
            [ 1.414213562373095, -1.632993161855452,  0.577350269189626],
            [ 1.414213562373095,  0.000000000000000, -1.732050807568877],
            [ 1.414213562373095,  0.000000000000000,  1.732050807568877],
            [ 1.414213562373095,  1.632993161855452, -0.577350269189626],
            [ 2.121320343559642, -0.408248290463863,  0.577350269189626],
            [ 2.121320343559642,  0.408248290463863, -0.577350269189626]
        ];
    }

    /**
     * Export polytope data to clipboard in JSON format
     * @returns {Object} The polytope data as an object
     */
    exportPolytopeData() {
        if (!this.vertices || this.vertices.length === 0) {
            console.warn('No vertices to export');
            return null;
        }

        // Get faces from vertices using QuickHull
        const faces = this.getFacesFromVertices(this.vertices);

        // Get edges from faces
        const edges = this.getEdgesFromFaces(faces);

        // Create export object
        const exportData = {
            name: this.currentPolytopeName,
            vertices: this.vertices,
            faces: faces,
            edges: edges
        };

        return exportData;
    }

    disposeGeometry() {
        if (!this.gl) return;

        // Delete all WebGL buffers
        if (this.posBuf) {
            this.gl.deleteBuffer(this.posBuf);
            this.posBuf = null;
        }
        if (this.colBuf) {
            this.gl.deleteBuffer(this.colBuf);
            this.colBuf = null;
        }
        if (this.normalBuf) {
            this.gl.deleteBuffer(this.normalBuf);
            this.normalBuf = null;
        }
        if (this.idxBuf) {
            this.gl.deleteBuffer(this.idxBuf);
            this.idxBuf = null;
        }

        // Delete VAO
        if (this.vao) {
            this.gl.deleteVertexArray(this.vao);
            this.vao = null;
        }

        // Clear geometry data
        this.geometry = null;
    }

    cleanup() {
        // Dispose of geometry resources
        this.disposeGeometry();

        // Delete shader program
        if (this.gl && this.prog) {
            this.gl.deleteProgram(this.prog);
        }
    }
}

customElements.define('polytope-viewer', PolytopeViewer);
