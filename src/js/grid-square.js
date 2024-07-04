class GridSquare {
    points = [];

    constructor(p1, p2, p3, p4) {
        this.points = [p1, p2 ,p3, p4];

        // Assuming a view from behind home plate, the first point should be hoem plate and continue clockwise
        let tempPoints = new Array(4);
        let sortedY = [...this.points].sort(function (a, b) { return b.screenPoint.y - a.screenPoint.y });
        tempPoints[2] = sortedY[3];
        tempPoints[0] = sortedY[0];
        sortedY.splice(3, 1);
        sortedY.splice(0, 1);
        let sortedX = [...sortedY].sort(function (a, b) { return a.screenPoint.y - b.screenPoint.y });
        tempPoints[1] = sortedX[0];
        tempPoints[3] = sortedX[1];
        this.points = tempPoints;
        console.log(this.points);

    }
}