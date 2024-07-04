class InfieldLine {
    isFull = false;
    isEmpty = false;
    p1;
    p2;

    constructor(x1, y1, empty) {
        this.p1 = new Point(x1, y1);
        this.isEmpty = empty;
    }

    addPoint(x, y) {
        if (this.isEmpty) {
            this.p1 = new Point(x, y);
            this.isEmpty = false;
        } else {
            this.p2 = new Point(x, y);
            this.isFull = true;
        }
    }
}