const processor = new chip8(document.getElementById("vp"));

//get DPI
let dpi = window.devicePixelRatio;
//get canvas
let canvas = document.getElementById('vp');
//get context
let ctx = canvas.getContext('2d');
function fix_dpi() {
//get CSS height
//the + prefix casts it to an integer
//the slice method gets rid of "px"
    let style_height = +getComputedStyle(canvas).getPropertyValue("height").slice(0, -2);
//get CSS width
    let style_width = +getComputedStyle(canvas).getPropertyValue("width").slice(0, -2);
//scale the canvas
    canvas.setAttribute('height', style_height * dpi);
    canvas.setAttribute('width', style_width * dpi);
}
fix_dpi();
document.getElementById("vp").getContext('2d').scale(4,4);

document.getElementById("file").addEventListener("change", () => {
    let reader = new FileReader();
    reader.onload = f => {
        console.log("File uploaded!");
        processor.run(f.target.result, {
            log: true,
            beep: true,
            sekret: true,
        });
    };
    reader.readAsBinaryString(document.getElementById("file").files[0]);
});