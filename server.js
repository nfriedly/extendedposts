var express = require('express');
var app = express();

app.all('*', function(req, res) {
	res.on('data', function(chunk) {
		console.log(chunk.toString());
	});
	res.redirect('https://s3.amazonaws.com/static.extendedposts.com/test.html');
});

app.listen(process.env.PORT);
