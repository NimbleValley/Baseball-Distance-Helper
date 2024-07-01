class FOVLine {
    isFull = false;
    isEmpty = false;
    p1;
    p2;

    constructor(x1, y1, empty) {
        this.p1 = {
            x: x1,
            y: y1
        }
        this.isEmpty = empty;
    }

    addPoint(x, y) {
        if (this.isEmpty) {
            this.p1 = {
                x: x,
                y: y
            }
            this.isEmpty = false;
        } else {
            this.p2 = {
                x: x,
                y: y
            }
            this.isFull = true;
        }
    }
}