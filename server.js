var express = require('express');
var app = express();

app.all('*', function(req, res) {
	res.redirect('https://s3.amazonaws.com/static.extendedposts.com/test.html');
});

app.listen(process.env.PORT);
