class GridSquare {
    points = new Array(4);
    screenPoints = new Array(4)
    worldPoints = new Array(4);

    constructor(p1, p2, p3, p4) {
        this.points = [p1, p2 ,p3, p4];

        // Assuming a view from behind home plate, the first point should be home plate and continue clockwise
        let tempPoints = new Array(4);
        let sortedY = [...this.points].sort(function (a, b) { return b.screenPoint.y - a.screenPoint.y });
        tempPoints[2] = sortedY[3];
        tempPoints[0] = sortedY[0];
        sortedY.splice(3, 1);
        sortedY.splice(0, 1);

        let sortedX = [...sortedY].sort(function (a, b) { return a.screenPoint.x - b.screenPoint.x });
        tempPoints[1] = sortedX[0];
        tempPoints[3] = sortedX[1];
        this.points = tempPoints;
        
        for(let i = 0; i < tempPoints.length; i ++) {
            this.worldPoints[i] = (tempPoints[i].worldPoint);
            this.screenPoints[i] = (tempPoints[i].screenPoint);
        }
    }

    updatePoints() {
        let tempPoints = new Array(4);
        let sortedY = [...this.points].sort(function (a, b) { return b.screenPoint.y - a.screenPoint.y });
        tempPoints[2] = sortedY[3];
        tempPoints[0] = sortedY[0];
        sortedY.splice(3, 1);
        sortedY.splice(0, 1);

        let sortedX = [...sortedY].sort(function (a, b) { return a.screenPoint.x - b.screenPoint.x });
        tempPoints[1] = sortedX[0];
        tempPoints[3] = sortedX[1];
        this.points = tempPoints;
        
        for(let i = 0; i < tempPoints.length; i ++) {
            this.worldPoints[i] = (tempPoints[i].worldPoint);
            this.screenPoints[i] = (tempPoints[i].screenPoint);
        }
    }
}