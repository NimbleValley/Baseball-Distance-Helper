async function getModel() {
    var model = await roboflow
    .auth({
        publishable_key: "rf_J6vWA7ucKOWwk5eoEqwgsciA87g1",
    })
    .load({
        model: "baseballcamerafov",
        version: 2,
    });

    return model;
}

var initialized_model = getModel();

initialized_model.then(function (model) {
    console.warn('Predicting:');
    model.detect(loadImage('./img/fenway-example.jpg')).then(function(predictions) {
        console.log("Predictions:", predictions);
    });
});

function loadImage(src) {
	return new Promise(function(res, rej) {
		const image = new Image();
		function loadCallback() {
			image.removeEventListener("load", loadCallback);
			image.removeEventListener("error", errorCallback);
			res(image);
		}
		function errorCallback() {
			image.removeEventListener("load", loadCallback);
			image.removeEventListener("error", errorCallback);
			rej(image);
		}
		image.addEventListener("load", loadCallback);
		image.addEventListener("error", errorCallback);
		image.src = src;
	});
}