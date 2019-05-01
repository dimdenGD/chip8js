class chip8 {
    constructor (canvas) {
        this.LOG = true;
        this.BEEP = true;
        this.S = false;

        let memory = new ArrayBuffer(0x1000);

        this.memory = new Uint8Array(memory);
        this.reg = new Array(16);
        this.screen = new Array(64 * 32);
        this.stack = new Array(16);
        this.opcode = 0;
        this.index = 0;
        this.pc = 0x200;
        this.sp = 0;
        this.keywait = false;
        this.exit = false;
        this.stop = () => {this.exit = true; setTimeout(() => this.exit = false, 2); warns = 0};
        this.pause = document.getElementById("pause").checked;

        let buzz = new Audio('buzz.wav'),
            tx = canvas.getContext('2d', { alpha: false }),
            clear = () => tx.clearRect(0, 0, canvas.width, canvas.height),
            log = msg => { if (this.LOG) console.log(msg) },
            fonts = [0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
            0x20, 0x60, 0x20, 0x20, 0x70, // 1
            0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
            0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
            0x90, 0x90, 0xF0, 0x10, 0x10, // 4
            0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
            0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
            0xF0, 0x10, 0x20, 0x40, 0x40, // 7
            0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
            0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
            0xF0, 0x90, 0xF0, 0x90, 0x90, // A
            0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
            0xF0, 0x80, 0x80, 0x80, 0xF0, // C
            0xE0, 0x90, 0x90, 0x90, 0xE0, // D
            0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
            0xF0, 0x80, 0xF0, 0x80, 0x80  // F
        ],
            delay_t = 0,
            sound_t = 0,
            should_draw = false,
            white = [255, 255, 255],
            black = [0, 0, 0],
            warns = 0,
            ord = str => str.charCodeAt(0),
            keys = {
                1: 0x1,
                2: 0x2,
                3: 0x3,
                4: 0xc,
                Q: 0x4,
                W: 0x5,
                E: 0x6,
                R: 0xd,
                A: 0x7,
                S: 0x8,
                D: 0x9,
                F: 0xe,
                Z: 0xa,
                X: 0,
                C: 0xb,
                V: 0xf
            };

        this.keypress = {};
        this.vx = 0;
        this.vy = 0;

        let that = this;

        // Opcodes

        this.funcs = {
            0x0000: () => {
                let eop = that.opcode & 0xf0ff;
                try { that.funcs[eop]() } catch (e) {
                    throw new Error("Unknown instruction: " + (eop));
                    warns++;
                }
            },
            0x00e0: () => {
                log("Cleared the screen.");
                that.screen = new Uint8Array(64*32).fill(0);
                should_draw = true;
            },
            0x00ee: () => {
                log("Return from subroutine.");
                that.pc = that.stack[--that.sp];
            },
            0x1000: () => {
                log("Jump to " + that.opcode & 0x0fff);
                that.pc = that.opcode & 0x0fff;

            },
            0x2000: () => {
                log("Calling the subroutine at ", (that.opcode & 0x0fff));
                that.stack[that.sp] = that.pc;
                that.sp++;
                that.pc = that.opcode & 0xFFF;
            },
            0x3000: () => {
                log(`Skipping the next instruction if VX (${that.reg[that.vx]}) == NN (${that.opcode & 0x00ff})`);
                if((that.reg[that.vx]) === (that.opcode & 0x00ff)) that.pc += 2;
            },
            0x4000: () => {
                log(`Skipping the next instruction if VX (${that.reg[that.vx]}) != NN (${that.opcode & 0x00ff})`);
                if((that.reg[that.vx]) !== (that.opcode & 0x00ff)) that.pc += 2;
            },
            0x5000: () => {
                log(`Skipping the next instruction if VX (${that.reg[that.vx]}) == VY (${that.reg[that.vy]})`);
                if((that.reg[that.vx]) === that.reg[that.vy]) that.pc += 2;
            },
            0x6000: () => {
                log("Set VX to " + (that.opcode & 0x00ff));
                that.reg[that.vx] = that.opcode & 0x00ff;
            },
            0x7000: () => {
                log(`Add ${that.opcode & 0xff} to VX`);
                let res = (that.opcode & 0xff) + that.reg[that.vx];
                if (res > 0xFF) {
                    that.reg[that.vx] = res - 0x100;
                } else that.reg[that.vx] = res;
            },
            0x8000: () => {
                let eop = that.opcode & 0xf00f;
                eop += 0xff0;
                    try { that.funcs[eop]() } catch (e) {
                    console.warn("Unknown instruction: " + (eop));
                    warns++;
                }
            },
            0x8FF0: () => {
                log(`Set VX to the value of VY. (${that.reg[that.vy]})`);
                that.reg[that.vx] = that.reg[that.vy];
                that.reg[that.vx] &= 0xff;
            },
            0x8FF1: () => {
                log("Set VX to VX or VY.");
                that.reg[that.vx] |= that.reg[that.vy];
                that.reg[that.vx] &= 0xff;
            },
            0x8FF2: () => {
                log("Set VX to VX and VY.");
                that.reg[that.vx] &= that.reg[that.vy];
                that.reg[that.vx] &= 0xff;
            },
            0x8FF3: () => {
                log("Set VX to VX xor VY.");
                that.reg[that.vx] ^= that.reg[that.vy];
                that.reg[that.vx] &= 0xff;
            },
            0x8FF4: () => {
                log("Add VY to VX. VF is set to 1 when there's a carry, and to 0 when there isn't.");
                // if((that.reg[that.vx] + that.reg[that.vy]) > 0xff) that.reg[0xf] = 1;
                // else that.reg[0xf] = 0;

                let result = that.reg[that.vx] + that.reg[that.vy];

                if (result > 0xFF) {
                    that.reg[that.vx] = result - 0x100;
                    that.reg[0xF] = 0x1;
                } else {
                    that.reg[that.vx] = result;
                    that.reg[0xF] = 0x0;
                }

            },
            0x8FF5: () => {
                log("VY is subtracted from VX. VF is set to 0 when there's a borrow, and 1 when there isn't.");
                if(that.reg[that.vy] > that.reg[that.vx]) that.reg[0xf] = 0;
                else that.reg[0xf] = 1;
                that.reg[that.vx] -= that.reg[that.vy];
                that.reg[that.vx] &= 0xff;
            },
            0x8FF6: () => {
                log("Shift VX right by one. VF is set to the value of the least significant bit of VX before the shift.");
                that.reg[0xf] = that.reg[that.vx] & 0x0001;
                that.reg[that.vx] >>= 1;
            },
            0x8FF7: () => {
                log("Set VX to VY minus VX. VF is set to 0 when there's a borrow, and 1 when there isn't.");
                if(that.reg[that.vx] > that.reg[that.vy]) that.reg[0xf] = 0;
                else that.reg[0xf] = 1;
                that.reg[that.vx] = that.reg[that.vy] - that.reg[that.vx];
                that.reg[that.vx] &= 0xff;
            },
            0x8FFE: () => {
                log("Shifts VX left by one. VF is set to the value of the most significant bit of VX before the shift.");
                that.reg[0xf] = (that.reg[that.vx] & 0x00f0) >> 7;
                that.reg[that.vx] <<= 1;
                that.reg[that.vx] &= 0xff;
            },
            0x9000: () => {
                log(`Skip the next instruction if VX doesn't equal VY. (${that.reg[that.vx] !== that.reg[that.vy]})`);
                if(that.reg[that.vx] !== that.reg[that.vy]) that.pc += 2;
            },
            0xA000: () => {
                log(`Set I (${that.index}) to the address ${that.opcode & 0x0fff}.`);
                that.index = that.opcode & 0x0fff;
            },
            0xB000: () => {
                log(`Jump to the address ${that.opcode & 0x0fff} plus ${that.reg[0]}.`);
                that.pc = (that.opcode & 0x0fff) + that.reg[0];
            },
            0xC000: () => {
                log(`Set VX to a random number and ${that.opcode & 0x00ff}.`);
                let rn = Math.floor(Math.random()*0xff);
                that.reg[that.vx] = rn & (that.opcode & 0x00ff);
                that.reg[that.vx] &= 0xff;
            },
            0xD000: () => {
                log("draw.");
                that.reg[0xf] = 0;
                let x = that.reg[that.vx] & 0xff,
                    y = that.reg[that.vy] & 0xff,
                    height = that.opcode & 0x000f,
                    row = 0;
                while(row < height) {
                    let curr_row = that.memory[row + that.index];
                    let pixel_offset = 0;
                    while(pixel_offset < 8) {
                        let loc = x + pixel_offset + ((y + row) * 64);
                        pixel_offset++;
                        if((y+row) > 32 || (x + pixel_offset) > 64) continue;
                        let mask = 1 << 8-pixel_offset;
                        let curr_pixel = (curr_row & mask) >> (8 - pixel_offset);
                        that.screen[loc] ^= curr_pixel;
                        if(that.screen[loc] === 0) that.reg[0xf] = 1;
                        else that.reg[0xf] = 0;
                    }
                    row++;
                }
                should_draw = true;
            },
            0xE000: () => {
                let eop = that.opcode & 0xf00f;
                try {
                    that.funcs[eop]();
                } catch (e) {
                    throw new Error("Unknown instruction: " + (eop));
                    warns++
                } 
            },
            0xE00E: () => {
                log("Skip the next instruction if the key stored in VX is pressed.");
                let key = that.reg[that.vx] & 0xf;
                if(that.keypress[key] === 1) that.pc += 2;
            },
            0xE001: () => {
                log("Skip the next instruction if the key stored in VX is isn't pressed.");
                let key = that.reg[that.vx] & 0xf;
                if(that.keypress[key] === 0) that.pc +=2;
            },
            0xF000: () => {
                let eop = that.opcode & 0xf0ff;
                try {
                    that.funcs[eop]();
                } catch (e) {
                    throw new Error("Unknown instruction: " + (eop));
                    warns++
                }
            },
            0xF007: () => {
                log("Set VX to the value of the delay timer. " + delay_t);
                that.reg[that.vx] = delay_t;
            },
            0xF00A: () => {
                log("A key press is awaited, and then stored in VX.");
                let ret = get_key();
                if(ret >= 0) that.reg[that.vx] = ret;
                else that.pc -= 2;
            },
            0xF015: () => {
                log("Set the delay timer to VX.");
                delay_t = that.reg[that.vx];
            },
            0xF018: () => {
                log("Set the sound timer to VX.");
                sound_t = that.reg[that.vx];
            },
            0xF01E: () => {
                log("Add VX to I. if overflow, vf = 1");
                that.index += that.reg[that.vx];
                if (that.index > 0xfff) {
                    that.reg[0xf] = 1;
                    that.index &= 0xfff;
                } else that.reg[0xf] = 0;
            },
            0xF029: () => {
                log("Set index to point to a character");
                that.index = (5*(that.reg[that.vx])) & 0xfff;
            },
            0xF033: () => {
                log("Store a number as BCD");
                that.memory[that.index]   = that.reg[that.vx] / 100;
                that.memory[that.index+1] = (that.reg[that.vx] % 100) / 10;
                that.memory[that.index+2] = that.reg[that.vx] % 10;
            },
            0xF055: () => {
                log("Store V0 to VX in memory starting at address I.");
                for(let i = 0; i <= that.vx; i++) that.memory[that.index + i] = that.reg[i];
                that.index += (that.vx + 1);
            },
            0xF065: () => {
                log("Fill V0 to VX with values from memory starting at address I.");
                for(let i = 0; i <= that.vx; i++) that.reg[i] = that.memory[that.index + i];
                that.index += (that.vx + 1);
            }
        };


        let get_key = () => {
            let i = 0;
            while (i < 16) {
                if (that.keypress[i] === 1) return i;
                i += 1;
            }
            return -1
        };

        this.init = () => {
            clear();
            let memory = new ArrayBuffer(0x1000);
            this.memory = new Uint8Array(memory);
            this.reg = new Array(16);
            this.screen = new Array(64 * 32);
            this.stack = new Array(16);
            this.opcode = 0;
            this.index = 0;
            this.pc = 0x200;
            this.sp = 0;
            this.pause = document.getElementById("pause").checked;
            delay_t = 0;
            sound_t = 0;
            should_draw = false;

            for (let i = 0; i < 80; i++) this.memory[i] = fonts[i];
        };
        this.cycle = () => {
            this.opcode = (this.memory[this.pc] << 8) | this.memory[this.pc + 1];
            let eop = this.opcode & 0xf000;
            log(`[${this.pc}] ` + "Opcode: " + eop);
            this.pc += 2;
            this.vx = (this.opcode & 0x0f00) >> 8;
            this.vy = (this.opcode & 0x00f0) >> 4;

            if(this.S) {
                let a = i => document.getElementById(i);
                let vxy = a("vxy");
                vxy.innerText = `VX: ${this.reg[this.vx]}; VY: ${this.reg[this.vy]}`;
                let mem = a("mem");
                mem.innerText = `Stack: ${this.stack} \n Reg: ${this.reg}`;
            }
            try {
                that.funcs[that.opcode & 0xF000]();
            } catch (e) {
                throw new Error("Unknown instruction: " + eop);
                warns++;
            }

            if(delay_t > 0) delay_t -= 1;
            if(sound_t > 0) {
                sound_t -= 1;
                if(sound_t === 0 && this.BEEP) buzz.play();
            }
        };
        this.draw = () => {
            if(!should_draw) return;
            should_draw = false;
            let i = 0;
            clear();
            while(i < 2048) {
                if(this.screen[i] === 1) {
                    let x = (i%64),
                        y = Math.floor((i / 32)/2);
                    tx.fillStyle = "rgb("+white.toString()+")";
                    tx.fillRect( x, y, 1, 1 );
                }
                i++;
            }
        };
        document.addEventListener("keydown", e => {
            if(keys[e.key.toUpperCase()] === undefined) return;
            log("Key press: " + e.key);
            that.keypress[keys[e.key.toUpperCase()]] = 1;
            if(this.keywait) this.keywait = false;
        });
        document.addEventListener("keyup", e => {
            if(keys[e.key.toUpperCase()] === undefined) return;
            log("Key release: " + e.key);
            that.keypress[keys[e.key.toUpperCase()]] = 0;
            if(this.keywait) this.keywait = false;
        });
        document.getElementById("pause").addEventListener("change", () => {
            this.pause = document.getElementById("pause").checked;
        });

        this.run = (binary, options) => {
            this.LOG = !!options.log;
            this.BEEP = !!options.beep;
            this.S = !!options.sekret;

            this.init();
            for(let i = 0; i < binary.length; i++) this.memory[i+0x200] = ord(binary[i]);
            let t = setInterval(() => {
                if(this.pause) return;
                if(this.exit || warns >= 5) clearInterval(t);
                this.cycle();
                this.draw();
            }, 6);
        }

    }
}