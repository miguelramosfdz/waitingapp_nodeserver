
// libraries
var _ 		= require('underscore'),
	fs 		= require('fs'),

	nconf = require('nconf');
nconf.env().argv();
nconf.file('./config.json');

GLOBAL.config = nconf;

var	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId,
	express = require('express'),
	models 	= require('./models/models.js'),
	nunjucks = require('nunjucks'),
	path 	= require('path'),
	m 		= require('./models'), // index.js gets loaded automatically
	serializer = require('serializer'),
	default_serializer = serializer.createSecureSerializer(config.get('serialize_key'), config.get('serialize_secret'));

var hour = 3600000;
var day = hour * 24;
var week = day * 7;

var flash = require('connect-flash');


// var MemcachedStore = require('connect-memcached')(express);

// var tesseract = require('node-tesseract');
// // Recognize text of any language in any format
// tesseract.process(__dirname + '/redid.jpg',function(err, text) {
//     if(err) {
//         console.error(err);
//     } else {
//     	console.log('tesseract');
//         console.log(text);
//     }
// });

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

GLOBAL.errorhandler = function(err, res, status_code, msg){
	status_code = status_code || 500;
	if(msg){
		console.error(msg);
	}
	console.error(err);
	if(res){
		res.status(status_code);
		res.json({
			msg: msg
		});
	}
	return;
};
GLOBAL.errorHandler = errorhandler;

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

	nunjucks.configure('views', {
	    autoescape: true,
	    express: app
	});
	app.set('view engine', 'html');

	// app.set('view engine', 'jade');
	// app.engine('tpl', require('hbs').__express);

	app.use(allowCrossDomain);
	// app.use(express.favicon());
	// app.use(express.logger('dev'));
	app.use(express.bodyParser({
	    uploadDir: __dirname + '/uploads',
	    keepExtensions: true
	}));
	// app.use(express.methodOverride());
	app.use(express.cookieParser('testkey'));
	
	app.use(express.session({ 
		secret: config.get('session_secret'),
		cookie: { maxAge: 60000 }
	}));
	app.use(flash());

	app.use(function(req, res, next) {
	  // Keep track of previous URL to redirect back to
	  // original destination after a successful login.
	  if (req.method !== 'GET') return next();
	  var path = req.path.split('/')[1];
	  if (/(auth|login|logout|signup)$/i.test(path)) return next();
	  req.session.returnTo = req.path;
	  next();
	});

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
	app.use(express.static(path.join(__dirname, 'public'), { maxAge: week }));

	// app.use(app.router);
	// // app.use(flash());

	app.use(function(err, req, res, next) {
	  //do logging and user-friendly error message display
	  console.log('ERROR');
	  console.log(err);
	  res.json(500);
	})

});

// app.all('/p*', function(req, res, next){
// 	console.log('-------------------PUBLIC-------------------');
// 	app.use(express.session({ cookie: { maxAge: 60000 }}));
// 	app.use(flash());
// 	next();
// });


require('./routes')(app);




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
		try {
			var token_data = default_serializer.parse(atok.toString())
		}catch(errToken){
			console.error('token error');
			console.log(errToken);
			errorhandler(errToken, res, 403);
			defer.reject();
			return defer.promise;
		}
		var	user_id = token_data[0],
			issue_timestamp = token_data[1],
			version = token_data[2];

			// Find this user
			m.User.findOne(
			{ 
				_id: user_id,
			},
			function(err, User) {
				// console.log(items);
				if(err){
					errorhandler(err, res);
					defer.reject();
					return;
				}
				if(!User){
					errorhandler('Invalid login credentials', res, 403, 'Invalid login credentials');
					return;
				}

				// setTimeout(function(){
				// 	console.log('trying remote update');
				// 	m.User.updateRemote(User._id);
				// },2000);
					
				// all good
				defer.resolve(User);
			}
		);

		
	}catch(err){
		// Failed auth
		console.log('Failed auth, outside try...catch');
		errorhandler(err, res, 500);
	}

	return defer.promise;

}

GLOBAL.validateEmail = function(email){

	// Test email address
	var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

GLOBAL.randomString = function(length) {
	var chars = '23456789ABCDEFGHJKMNPQRSTUVWXTZabcdefghkmnpqrstuvwxyz';
	length = length ? length : 32;

	var string = '';

	for (var i = 0; i < length; i++) {
		var randomNumber = Math.floor(Math.random() * chars.length);
		string += chars.substring(randomNumber, randomNumber + 1);
	}

	return string;
}

GLOBAL.getRandomInt = function(min,max) {
	 return Math.floor(Math.random() * (max - min + 1)) + min;
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

GLOBAL.swuConfig = function(){
	var keys = ['app_name','server_root','server_media_root'];
	return _.pick(config.get(),keys);
};

GLOBAL.swuUser = function(User){
	// returns a pruned user

	var tmpUser = JSON.parse(JSON.stringify(User));

	var allowed = [
		'_id',
		'email',
		'profilephoto',
		'profile',
		'last_gift_update'
	];

	var returnObj = {};
	_.each(allowed, function(key){
		if(tmpUser[key] != undefined){
			returnObj[key] = tmpUser[key];
		}
	});

	return returnObj;
};

var port = process.env.PORT || 3000;
console.log(process.env.PORT);
app.listen(port);
console.log('Listening on port ' + port);
