var socket = io();
socket.on('send-points', handleValues);
socket.on('image-error', handleImageError);

const imageUpload = document.getElementById('image-upload');
const imageUploadContainer = document.getElementById('image-upload-container');
const validateCanvas = document.getElementById('validate-canvas');

var uploadedImage;

imageUpload.addEventListener('change', function () {
    const reader = new FileReader();
    reader.onload = function () {
        uploadedImage = this.result;
        const base64 = this.result.replace(/.*base64,/, '');
        socket.emit('analyze_image', base64);
    };
    reader.readAsDataURL(this.files[0]);
}, false);

function handleImageError(error) {
    alert(`Error: ${error}`);
    imageUploadContainer.style.borderColor = 'rgb(221, 44, 44)';
}

async function handleValues(data) {
    console.log(data);
    imageUploadContainer.style.borderColor = 'rgb(109, 221, 44)';

    let ctx = validateCanvas.getContext('2d');

    validateCanvas.width = data.image.width;
    validateCanvas.height = data.image.height;

    await loadImage(uploadedImage).then(image =>
        ctx.drawImage(image, 0, 0)
    );

    const points = data.predictions[0].points;
    //let hull = convexhull.makeHull(points);
    let hull = points;

    // Merge by distance
    let mergeDistance = validateCanvas.width / 85;
    for (let i = 0; i < hull.length; i++) {
        for (let p = i+1; p < hull.length; p++) {
            if (getDistance(hull[i], hull[p]) < mergeDistance) {
                hull[i].x = getMidpoint(hull[p].x, hull[i].x);
                hull[i].y = getMidpoint(hull[p].y, hull[i].y);
                hull.splice(p, 1);
                p--;
            }
        }
    }

    ctx.fillStyle = 'lime';
    console.log(hull)
    hull.forEach(element => {
        ctx.fillRect(element.x, element.y, 4, 4);
    });

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;

    let sortedX = [...hull].sort(function (a, b) { return a.x - b.x });
    let sortedY = [...hull].sort(function (a, b) { return a.y - b.y });

    let boundingBox = {
        l: sortedX[0].x,
        t: sortedY[0].y,
        r: sortedX[sortedX.length - 1].x,
        b: sortedY[sortedY.length - 1].y,
        rot: 0,
        bestL: 0,
        bestT: 0,
        bestR: 0,
        bestB: 0,
        totalOffset: 10000000
    }

    let centerX = (boundingBox.r - boundingBox.l) / 2 + boundingBox.l;
    let centerY = (boundingBox.b - boundingBox.t) / 2 + boundingBox.t;

    for (let currentRot = 5; currentRot <= 180; currentRot += 5) {
        for (let p = 0; p < hull.length; p++) {
            let oldX = hull[p].x;
            let oldY = hull[p].y;

            hull[p].x = centerX + (oldX - centerX) * Math.cos(toRad(5)) - (oldY - centerY) * Math.sin(toRad(5));
            hull[p].y = centerY + (oldX - centerX) * Math.sin(toRad(5)) + (oldY - centerY) * Math.cos(toRad(5));
        }

        let newSortedX = [...hull].sort(function (a, b) { return a.x - b.x });
        let newSortedY = [...hull].sort(function (a, b) { return a.y - b.y });

        boundingBox.l = newSortedX[0].x;
        boundingBox.t = newSortedY[0].y;
        boundingBox.r = newSortedX[newSortedX.length - 1].x;
        boundingBox.b = newSortedY[newSortedY.length - 1].y;

        let tempOffset = 0;

        for (let p = 0; p < hull.length; p++) {
            tempOffset += Math.min(...[hull[p].x - boundingBox.l, boundingBox.r - hull[p].x, hull[p].y - boundingBox.t, boundingBox.b - hull[p].y])
        }

        if (tempOffset <= boundingBox.totalOffset) {
            if (currentRot > 90) {
                currentRot = 180 - currentRot;
            }
            boundingBox.rot = toRad(-currentRot);
            boundingBox.totalOffset = tempOffset;
            boundingBox.bestL = boundingBox.l - 15;
            boundingBox.bestT = boundingBox.t - 15;
            boundingBox.bestR = boundingBox.r + 15;
            boundingBox.bestB = boundingBox.b + 15;
        }
    }

    centerX = (boundingBox.bestR - boundingBox.bestL) / 2 + boundingBox.bestL;
    centerY = (boundingBox.bestB - boundingBox.bestT) / 2 + boundingBox.bestT;

    /*
    ctx.fillStyle = 'gold';
    ctx.fillRect(centerX, centerY, 4, 4);
    
    ctx.fillStyle = 'lime';
    hull.forEach(element => {
        ctx.fillRect(element.x, element.y, 2, 2);
    });
    */

    console.log(boundingBox.rot * 180 / Math.PI);

    let rotatedBoundingBox = [
        {
            x: (centerX + (boundingBox.bestL - centerX) * Math.cos(boundingBox.rot) - (boundingBox.bestT - centerY) * Math.sin(boundingBox.rot)),
            y: (centerY + (boundingBox.bestL - centerX) * Math.sin(boundingBox.rot) + (boundingBox.bestT - centerY) * Math.cos(boundingBox.rot))
        },
        {
            x: (centerX + (boundingBox.bestR - centerX) * Math.cos(boundingBox.rot) - (boundingBox.bestT - centerY) * Math.sin(boundingBox.rot)),
            y: (centerY + (boundingBox.bestR - centerX) * Math.sin(boundingBox.rot) + (boundingBox.bestT - centerY) * Math.cos(boundingBox.rot))
        },
        {
            x: (centerX + (boundingBox.bestR - centerX) * Math.cos(boundingBox.rot) - (boundingBox.bestB - centerY) * Math.sin(boundingBox.rot)),
            y: (centerY + (boundingBox.bestR - centerX) * Math.sin(boundingBox.rot) + (boundingBox.bestB - centerY) * Math.cos(boundingBox.rot))
        },
        {
            x: (centerX + (boundingBox.bestL - centerX) * Math.cos(boundingBox.rot) - (boundingBox.bestB - centerY) * Math.sin(boundingBox.rot)),
            y: (centerY + (boundingBox.bestL - centerX) * Math.sin(boundingBox.rot) + (boundingBox.bestB - centerY) * Math.cos(boundingBox.rot))
        }
    ];

    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(rotatedBoundingBox[i].x, rotatedBoundingBox[i].y);
        ctx.lineTo(rotatedBoundingBox[i + 1].x, rotatedBoundingBox[i + 1].y);
        ctx.stroke();
    }

    /*
    ctx.beginPath();
    ctx.moveTo(rotatedBoundingBox[3].x, rotatedBoundingBox[3].y);
    ctx.lineTo(rotatedBoundingBox[0].x, rotatedBoundingBox[0].y);
    ctx.stroke();
    */
    let newPoints = [
        {
            x: 0,
            y: 0
        },
        {
            x: 0,
            y: 0
        },
        {
            x: 0,
            y: 0
        },
        {
            x: 0,
            y: 0
        },
        {
            x: 0,
            y: 0
        },
        {
            x: 0,
            y: 0
        },
        {
            x: 0,
            y: 0
        },
        {
            x: 0,
            y: 0
        }
    ];

    if(Math.abs(90-(Math.abs(boundingBox.rot * 180 / Math.PI))) < 35) {
        rotatedBoundingBox[2].x = sortedX[0].x;
        rotatedBoundingBox[3].x = sortedX[0].x;

        newPoints[6] = {
            x: sortedX[0].x,
            y: sortedX[0].y
        }

        for(let i = 7; i < sortedX.length; i ++) {
            if(sortedX[i].y > sortedX[0].y) {
                newPoints[7] = {
                    x: sortedX[i].x,
                    y: sortedX[i].y
                }
                break;
            }
        }
    }

    ctx.strokeStyle = 'gold';
    ctx.lineWidth = 3;

    console.log(hull);
    console.log(newPoints);

    for (let i = 0; i < 8; i+=2) {
        ctx.beginPath();
        ctx.moveTo(newPoints[i].x, newPoints[i].y);
        ctx.lineTo(newPoints[i + 1].x, newPoints[i + 1].y);
        ctx.stroke();
    }
}

const loadImage = src =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function getMidpoint(v1, v2) {
    return (v1 + v2) / 2;
}