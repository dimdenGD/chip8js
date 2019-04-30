const processor = new chip8(document.getElementById("vp"));
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