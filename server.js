
// libraries
var _ 		= require('underscore'),
	fs 		= require('fs'),

	nconf = require('nconf');
	nconf.env().argv();
	nconf.file('./config.json');

GLOBAL.config = nconf;

	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId,
	express = require('express'),
	models 	= require('./models/models.js'),
	path 	= require('path'),
	m 		= require('./models'), // index.js gets loaded automatically
	serializer = require('serializer'),
	default_serializer = serializer.createSecureSerializer(nconf.get('serializer_key'), nconf.get('serializer_secret'));


// Create the "uploads" folder if it doesn't exist
fs.exists(__dirname + '/uploads', function (exists) {
    if (!exists) {
        console.log('Creating directory ' + __dirname + '/uploads');
        fs.mkdir(__dirname + '/uploads', function (err) {
            if (err) {
                console.log('Error creating ' + __dirname + '/uploads');
                process.exit(1);
            }
        })
    } else {
      console.log('/uploads Directory exists');
    }
});

var app = express();

// GLOBALS
GLOBAL.models = models;
GLOBAL.app = app;
GLOBAL.m = m;

// cross-domain middleware
var allowCrossDomain = function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
	res.header('Access-Control-Allow-Headers', 'x-token,x-email,x-password, Content-Type, Authorization, Content-Length, X-Requested-With');
	//res.header("Access-Control-Allow-Headers", "X-Requested-With");
	// intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
}

// rawbody middleware (not used)
var getRawBody = function(req, res, next) {
	var data = '';
	req.setEncoding('utf8');
	req.on('data', function(chunk) { 
		 data += chunk;
	});
	req.on('end', function() {
		req.rawBody = data;
		next()
	});

}

app.configure(function(){
	// app.set('port', process.env.PORT || 8088);
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');

	app.use(allowCrossDomain);
	// app.use(express.favicon());
	// app.use(express.logger('dev'));
	app.use(express.bodyParser({
	    uploadDir: __dirname + '/uploads',
	    keepExtensions: true
	}));
	// app.use(express.methodOverride());
	app.use(express.cookieParser('testkey'));
	

	// app.use(express.session({ 
	// 	secret: creds.session_secret
	// 	// store: new MemoryStore
	// }));

	// // Session middleware for layout
	// app.use(function(req, res, next){
	// 	// res.locals.sess = req.session;
	// 	next();
	// });

	// app.use(require('stylus').middleware(__dirname + '/public'));
	app.use(express.static(path.join(__dirname, 'public')));

	// app.use(app.router);
	// // app.use(flash());

	app.use(function(err, req, res, next) {
	  //do logging and user-friendly error message display
	  console.log('ERROR');
	  console.log(err);
	  res.json(500);
	})

});


require('./routes')(app);



app.get('/push/:type/:id', function(req, res){
	// accepts a push registration id
	var id = req.params.id,
		type = req.params.type;

		// trip: 5286948e6a137bc9d3c5049c
		// driver: 527fe36f24275af251000003

	// console.log('Push id');
	// console.log(push_id);

	var objToSend = {
						'message':'Vehicle trip ended',
						'title' : 'Trip Just Ended',
						'type': 'trip',
						'_id': '5286948e6a137bc9d3c5049c'
					};

	switch(type){
		case 'trip':
			objToSend.message = 'Nick just got Home with the Pathfinder';
			objToSend.title = 'Trip recently ended';
			break;
		case 'driver':
			objToSend.message = 'Girlfriend is now driving the Pathfinder';
			objToSend.title = 'Driving Girlfriend in Pathfinder';
			break;
		default:
			res.json('fuckity');
			return;
	}

	// other items
	objToSend.type = type;
	objToSend._id = id;

	console.log(' ');
	console.log('objToSend');
	console.log(objToSend);

	var collection = models.mongo.collection('users');
	collection.find({email: 'nicholas.a.reed@gmail.com'}).toArray(function(err, items) {
		// console.log(items);
		if(!items || typeof items == undefined || items.length < 1){
			res.status(403);
			res.json(false);
			return;
		} else {
			// Found all users
			// - iterate over them

			var user = items[0];

			if(!user.android){
				console.log(user);
				res.json('no android');
				return;
			}
			
			var push_id = user.android[0].reg_id;
			console.log('Push ID');
			console.log(push_id);
			models.pushToAndroid(
					push_id, // registration id of android device
					// data
					objToSend,
					'NemesisNotifications', // collapseKey
					60, // timeToLive (expire_time basically)
					5 // retries
				)
				.then(function(result){
					console.log('result');
					console.log(result);
					res.json(result);
				});
		}
	});



});




// app.get('/trips', function(req, res) {
// 	console.log("Finding all items for trips db");

// 	checkUserAuth(req, res)
// 		.then(function(user){
// 			var collection = models.mongo.collection('trips');
// 			collection.find({user_id : user._id}).toArray(function(err, items) {
// 				res.json(items);
// 			});
// 		});

// });





GLOBAL.checkUserAuth = function(req, res, suppliedToken){
	// Returns a user, if the user is authenticated
	// - should also hit a cache for the user!

	console.log('checkUserAuth');

	var defer = Q.defer();

	// Newer version, with tokens and serializers
	var atok = req.header('x-token');
	if(suppliedToken !== undefined){
		atok = suppliedToken;
	}
	try {
		// Parse token
		var token_data = default_serializer.parse(atok.toString()),
			user_id = token_data[0],
			issue_timestamp = token_data[1],
			version = token_data[2];

			// Find this user
			m.User.find(
			{ 
				_id: user_id,
			},
			function(err, items) {
				// console.log(items);
				if(!items || typeof items == undefined || items.length < 1){
					// defer.resolve(false);
					console.log('Unable to find user in checkUserAuth newer');
					// console.log('MASS FAIL');
					console.log(items);
					console.log(typeof items);
					defer.reject();
					res.status(403);
					res.json(false);
				} else {
					defer.resolve(items[0]);
				}
			}
		);

		
	}catch(err){
		// Failed auth
		console.error('failed authentication');
		console.error(err);
		defer.reject();
		res.status(403);
		res.json(false);
	}

	return defer.promise;

}

GLOBAL.validateEmail = function(email){

	// Test email address
	var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

GLOBAL.randomString = function(length) {
	var chars = '23456789ABCDEFGHJKLMNOPQRSTUVWXTZabcdefghikmnpqrstuvwxyz';
	length = length ? length : 32;

	var string = '';

	for (var i = 0; i < length; i++) {
		var randomNumber = Math.floor(Math.random() * chars.length);
		string += chars.substring(randomNumber, randomNumber + 1);
	}

	return string;
}

GLOBAL.guid = function() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
  }
  return function() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
  };
};

var port = process.env.PORT || 3000;
console.log(process.env.PORT);
app.listen(port);
console.log('Listening on port ' + port);
