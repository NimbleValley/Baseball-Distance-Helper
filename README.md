**Designed to aid in dimensioning of baseball fields for use in modeling as well as determining real life distances.**

**How to use:** 

Upload a baseball diamond. Note that it must have grass inside the infield. Additionally, the diamond must be oriented so that home plate is at the bottom and second base is at the top of the diamond, so any photo from behind the field should work. After uploading, click on a vertex and then one that is parallel. After clicking, it will show a line which should roughly match up with the edge of the infield. Repeat until all four sides have been identified. After the calculations have occurred you can freely click or drag anywhere within the field of play to get the approximate distance from home plate.

**Preview:**

![Baseball Dimension Analyzer  - Google Chrome 2024-07-04 20-12-11 (1)](https://github.com/NimbleValley/Baseball-Distance-Helper/assets/97319135/d44dca74-fd65-4524-b285-b651ca47cd55)

**Screenshots:**

![image](https://github.com/NimbleValley/Baseball-Camera-Solver/assets/97319135/cd0b2122-9d04-4aac-a0d1-e5d60fd0d534)
![image](https://github.com/NimbleValley/Baseball-Camera-Solver/assets/97319135/8e0fd3ca-2852-49e4-b994-199b1adf8308)

**How it works:**

After the image is uploaded, a segmentation model trained using Roboflow finds possible points along the interior of the infield. The user selects points that form lines. To ensure the user can select any sides in any order, they are sorted based off slope and coordinates.

When all four sides have been selected, the points where the lines meet are found which theoretically form a square on a regular field. Additionally, the sides of the first square are estimated at 86 feet as they are just short of the 90 foot bases. Although not perfectly accurate, this constant will be used for now until an updated version.

After this, the two vanishing points are found as well as the "middle" vanishing point which intersects the lines formed by the two vanishing points and second base/home plate. After these have been found, it finds 4 more squares up the third base line. First it finds the top point of the new square which is the intersection of the lines formed by the middle vanishing point + the bottom of the new square and the top + right vertices of the square below. The left point can then be found as the intersection between lines formed by the right vanishing point + the top point just found and the bottom + left vertices of the square below. The right point would then simply be the top vertex of the square below. 

While this is helpful in drawing a grid, it serves no use unless each point also has world coordinates with it. These are found simply by adding the constant specified above, 86, to either the world x, y, or both of the previous coordinates. Home plate is labeled as (0, 0), which will make calculations of distance very easy later on.

After all squares have been found up the third base line, 4 more sets of four squares are found going down the first base line using a slightly different but similar process or finding intersection points. After this, we have a grid of 25 squares that hopefully match the camera's perspective in the image.

Now it's time to find the distance from where the user clicks. When the user's mouse is down, the distance can be found simply by subdividing the squares. First it iterates through the initial 25 squares to find which one the point is in. If it is not found in any, then we cannot calculate the distance using this technique and it displays a question mark in the distance indicator. However, if it is found within a square, that square is subdivided 10 times. Each time it subdivides it creates four new squares inside the old square. These are found by making an 'x' to find the center of the original square. Then, the other vertices are found by finding the intersection points between the known vertices, vanishing points, and the center point in various orders. The world coordinates are easier to find as they are just the midpoint between the old vertices. Then, it finds which of the four subdivisions the target point is in and subdivides that square again. After 10 iterations it is very accurate but still just an estimate. The final distance is found by using the pythagorean theorem on the bottom point of the 10th subdivision.

