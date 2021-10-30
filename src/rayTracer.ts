// classes you may find useful.  Feel free to change them if you don't like the way
// they are set up.

export class Vector {
    constructor(public x: number,
                public y: number,
                public z: number) {
    }
    static times(k: number, v: Vector) { return new Vector(k * v.x, k * v.y, k * v.z); }
    static minus(v1: Vector, v2: Vector) { return new Vector(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z); }
    static plus(v1: Vector, v2: Vector) { return new Vector(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z); }
    static dot(v1: Vector, v2: Vector) { return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z; }
    static mag(v: Vector) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
    static norm(v: Vector) {
        var mag = Vector.mag(v);
        var div = (mag === 0) ? Infinity : 1.0 / mag;
        return Vector.times(div, v);
    }
    static cross(v1: Vector, v2: Vector) {
        return new Vector(v1.y * v2.z - v1.z * v2.y,
                          v1.z * v2.x - v1.x * v2.z,
                          v1.x * v2.y - v1.y * v2.x);
    }
}

export class Color {
    constructor(public r: number,
                public g: number,
                public b: number) {
    }
    static scale(k: number, v: Color) { return new Color(k * v.r, k * v.g, k * v.b); }
    static plus(v1: Color, v2: Color) { return new Color(v1.r + v2.r, v1.g + v2.g, v1.b + v2.b); }
    static times(v1: Color, v2: Color) { return new Color(v1.r * v2.r, v1.g * v2.g, v1.b * v2.b); }
    static white = new Color(1.0, 1.0, 1.0);
    static grey = new Color(0.5, 0.5, 0.5);
    static black = new Color(0.0, 0.0, 0.0);
    static toDrawingColor(c: Color) {
        var legalize = (d: number) => d > 1 ? 1 : d;
        return {
            r: Math.floor(legalize(c.r) * 255),
            g: Math.floor(legalize(c.g) * 255),
            b: Math.floor(legalize(c.b) * 255)
        }
    }
}

interface Ray {
    start: Vector;
    dir: Vector;
}

interface pLight {
    c: Color;
    pos: Vector;
}

class Eye {
    constructor(public pos: Vector,
                public lookAt: Vector,
                public upVector: Vector) {
    }
    reset() {
        this.pos = new Vector(0, 0, 0);
        this.lookAt = new Vector(0, 0, -1);
        this.upVector = new Vector(0, 1, 0);
    }
}

class Sphere {
    constructor(
    public pos: Vector,
    public r: number,
    public diffuse: Color,
    public ka: number,
    public ks: number,
    public sp: number) {
    }
}

interface Hit {
    hit: boolean;
    sphere: Sphere | undefined;
    hitPos: Vector | undefined;
}

var pLights : pLight[] = [];
var spheres : Sphere[] = [];
var ambient : Color = new Color(1, 1, 1);
var background: Color = new Color(1, 1, 1);
var fov: number = (Math.PI / 2);
const eye: Eye = new Eye(new Vector(0, 0, 0), new Vector(0, 0, -1), new Vector(0, 1, 0));

// A class for our application state and functionality
class RayTracer {
    // the constructor paramater "canv" is automatically created 
    // as a property because the parameter is marked "public" in the 
    // constructor parameter
    // canv: HTMLCanvasElement
    //
    // rendering context for the canvas, also public
    // ctx: CanvasRenderingContext2D

    // initial color we'll use for the canvas
    canvasColor = "lightyellow"

    canv: HTMLCanvasElement
    ctx: CanvasRenderingContext2D 

    // div is the HTMLElement we'll add our canvas to
    // width, height are the size of the canvas
    // screenWidth, screenHeight are the number of pixels you want to ray trace
    //  (recommend that width and height are multiples of screenWidth and screenHeight)
    constructor (div: HTMLElement,
        public width: number, public height: number, 
        public screenWidth: number, public screenHeight: number) {

        // let's create a canvas and to draw in
        this.canv = document.createElement("canvas");
        this.ctx = this.canv.getContext("2d")!;
        if (!this.ctx) {
            console.warn("our drawing element does not have a 2d drawing context")
            return
        }
 
        div.appendChild(this.canv);

        this.canv.id = "main";
        this.canv.style.width = this.width.toString() + "px";
        this.canv.style.height = this.height.toString() + "px";
        this.canv.width  = this.width;
        this.canv.height = this.height;
    }

    // API Functions you should implement

    // clear out all scene contents
    reset_scene() {
        while (pLights.length != 0) {
            pLights.pop();
        }
        while (spheres.length != 0) {
            spheres.pop();
        }
        ambient = new Color(1, 1, 1);
        background = new Color(1, 1, 1);
        fov = (Math.PI / 2);
        eye.reset();
    }

    // create a new point light source
    new_light (r: number, g: number, b: number, x: number, y: number, z: number) {
        var c = new Color(r, g ,b);
        var pos = new Vector(x, y, z);
        var pLight : pLight = {c, pos};
        pLights.push(pLight);
    }

    // set value of ambient light source
    ambient_light (r: number, g: number, b: number) {
        ambient = new Color(r, g ,b);
    }

    // set the background color for the scene
    set_background (r: number, g: number, b: number) {
        background = new Color(r, g, b);
    }

    // set the field of view
    DEG2RAD = (Math.PI/180)
    set_fov (theta: number) {
        fov = theta * this.DEG2RAD;
    }

    // set the virtual camera's position and orientation
    // x1,y1,z1 are the camera position
    // x2,y2,z2 are the lookat position
    // x3,y3,z3 are the up vector
    set_eye(x1: number, y1: number, z1: number, 
            x2: number, y2: number, z2: number, 
            x3: number, y3: number, z3: number) {
        var pos = new Vector(x1, y2, z3);
        var lookAt = new Vector(x2, y2, z2);
        var up = new Vector(x3, y3, z3);
        eye.pos = pos;
        eye.lookAt = lookAt;
        eye.upVector = up;
    }

    // create a new sphere
    new_sphere (x: number, y: number, z: number, radius: number, 
                dr: number, dg: number, db: number, 
                k_ambient: number, k_specular: number, specular_pow: number) {
        var p = new Vector(x, y, z);
        var diffuse = new Color(dr, dg, db);
        spheres.push(new Sphere(p, radius, diffuse, k_ambient, k_specular, specular_pow));
    }

    // INTERNAL METHODS YOU MUST IMPLEMENT

    // create an eye ray based on the current pixel's position
    private eyeRay(i: number, j: number): Ray {
        var start : Vector = eye.pos;
        var d = 1 / (Math.tan(fov / 2));
        var w : Vector = Vector.norm(Vector.times(-1, Vector.minus(eye.lookAt, eye.pos)));
        var u : Vector = Vector.cross(eye.upVector, w);
        var dir : Vector = Vector.norm(Vector.plus(Vector.plus(Vector.times(-1 * d, w), Vector.times(-1 + (2 * i / this.screenWidth), u)), Vector.times(1 - (2 * j / this.screenHeight), eye.upVector)));
        return {start, dir};
    }

    private traceRay(ray: Ray, depth: number = 0): Color {
        var hit : Hit = this.sphereCollision(ray);
        if (hit.sphere && hit.hitPos) {
            var a = Color.times(Color.scale(hit.sphere.ka, ambient), hit.sphere.diffuse);
            var norm = Vector.norm(Vector.minus(hit.hitPos, hit.sphere.pos));
            var lightTerm : Color = new Color(0, 0, 0);
            for (var i = 0; i < pLights.length; i++) {
                var Li = Vector.norm(Vector.minus(pLights[i].pos, hit.hitPos));
                var Ri = Vector.norm(Vector.minus(ray.dir, Vector.times(2 * Vector.dot(ray.dir, norm), norm)));
                var diffuse = Color.scale(Vector.dot(norm, Li), hit.sphere.diffuse);
                var sdot = Vector.dot(Ri, Li);
                if (sdot < 0) {
                    sdot = 0;
                }
                var specular = Color.scale(Math.pow(sdot, hit.sphere.sp) * hit.sphere.ks, Color.white);

                lightTerm = Color.plus(lightTerm, (Color.times(Color.plus(diffuse, specular), pLights[i].c)));
            }
            return Color.plus(a, lightTerm);
        }
        return background;

    }

    private sphereCollision(ray : Ray) : Hit {
        var closestSphere : Sphere | undefined = undefined;
        var closestT : number | undefined = undefined;
        for (var i = 0; i < spheres.length; i++) {
            var t = this.sphereIntersection(ray, spheres[i]);
            if (t && !closestT) {
                closestT = t;
                closestSphere = spheres[i];
            } else if (t && closestT && t < closestT) {
                closestT = t;
                closestSphere = spheres[i];
            }
        }
        if (closestT && closestSphere) {
            var hitPos = Vector.plus(ray.start, Vector.times(closestT, ray.dir));
            return {hit: true, sphere: closestSphere, hitPos: hitPos};
        }
        return {hit: false, sphere: undefined, hitPos: undefined};
    }

    private sphereIntersection(ray: Ray, sphere: Sphere) : number | undefined {
        var a = (ray.dir.x * ray.dir.x + ray.dir.y * ray.dir.y + ray.dir.z * ray.dir.z);
        var b = 2 * ((ray.start.x - sphere.pos.x) * ray.dir.x + (ray.start.y - sphere.pos.y) * ray.dir.y + (ray.start.z - sphere.pos.z) * ray.dir.z);
        var c = (ray.start.x - sphere.pos.x) * (ray.start.x - sphere.pos.x) + (ray.start.y - sphere.pos.y) * (ray.start.y - sphere.pos.y) 
                + (ray.start.z - sphere.pos.z) * (ray.start.z - sphere.pos.z) - sphere.r * sphere.r; 
        var determinant = (b * b - 4 * a * c);
        if (determinant < 0) {
            return undefined;
        }
        var t1 = (-1 * b + Math.sqrt(determinant)) / (2 * a);
        var t2 = (-1 * b - Math.sqrt(determinant)) / (2 * a);
        return Math.min(t1, t2);
    }

    // draw_scene is provided to create the image from the ray traced colors. 
    // 1. it renders 1 line at a time, and uses requestAnimationFrame(render) to schedule 
    //    the next line.  This causes the lines to be displayed as they are rendered.
    // 2. it uses the additional constructor parameters to allow it to render a  
    //    smaller # of pixels than the size of the canvas
    draw_scene() {

        // rather than doing a for loop for y, we're going to draw each line in
        // an animationRequestFrame callback, so we see them update 1 by 1
        var pixelWidth = this.width / this.screenWidth;
        var pixelHeight = this.height / this.screenHeight;
        var y = 0;
        
        this.clear_screen();

        var renderRow = () => {
            for (var x = 0; x < this.screenWidth; x++) {

                var ray = this.eyeRay(x, y);
                var c = this.traceRay(ray);

                var color = Color.toDrawingColor(c)
                this.ctx.fillStyle = "rgb(" + String(color.r) + ", " + String(color.g) + ", " + String(color.b) + ")";
                this.ctx.fillRect(x * pixelWidth, y * pixelHeight, pixelWidth+1, pixelHeight+1);
            }
            
            // finished the row, so increment row # and see if we are done
            y++;
            if (y < this.screenHeight) {
                // finished a line, do another
                requestAnimationFrame(renderRow);            
            } else {
                console.log("Finished rendering scene")
            }
        }

        renderRow();
    }

    clear_screen() {
        this.ctx.fillStyle = this.canvasColor;
        this.ctx.fillRect(0, 0, this.canv.width, this.canv.height);

    }
}
export {RayTracer}