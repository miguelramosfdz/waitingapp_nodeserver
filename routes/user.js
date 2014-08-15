
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId,
	serializer = require('serializer'),
	request = require('request'),
	default_serializer = serializer.createSecureSerializer('32f9s8fdhf23f', 'sdf9838nf8hsdfh823fmsdjfj'); // encryption key, signing key

module.exports = function(app) {
  
	app.get('/me', function(req, res) {
		console.log("Simple info about the the logged-in user");

		checkUserAuth(req, res)
			.then(function(user){

				// Find the player_id for "Me" for this user
				m.Player.findMe(user._id, function(err, MePlayer){
					res.json(MePlayer);
				});

			});
	});


	app.get('/user/profile/:user_id', function(req, res) {
		console.log("Returning User Profile");

		checkUserAuth(req, res)
			.then(function(user){
				// Remove user email/password/etc from response

				// Get all my player id's too
				// - easier than asking if I belong to everything
				m.User.findOne({
					_id: ObjectID(req.params.user_id)
				})
				.exec(function(err, User){
					if(err){
						console.log('Err: unable to find user');
						res.status(500);
						res.json(false);
						return;
					}

					var tmpUser = User.toJSON();

					var allowed = [
						'_id',
						'username',
						'profilephoto',
						'profile'
					];

					var returnObj = {};
					_.each(allowed, function(key){
						if(tmpUser[key] != undefined){
							returnObj[key] = tmpUser[key];
						}
					});

					res.json(returnObj);
				});

				

			});
	});


	app.get('/user', function(req, res) {
		console.log("Returning User");

		checkUserAuth(req, res)
			.then(function(user){
				// Remove user email/password/etc from response

				var allowed = [
					'_id',
					'email',
					'password',
					'friends',
					'username',
					'profilephoto',
					'profile',
					'android',
					'ios',
					'flags'
				];

				var returnObj = {};
				_.each(allowed, function(key){
					if(user[key] != undefined){
						returnObj[key] = user[key]; // maybe undefined?
					}
				});
				res.json(returnObj);

			});
	});


	app.put('/user', function(req, res) {
		console.log("Individual user updating ANDROID/IOS");

		checkUserAuth(req, res)
			.then(function(user){

				var allowed = [
					'android',
					'ios'
				];	

				var objs = {},
					tmpObjs = req.body;

				_.each(allowed, function(key){
					if(tmpObjs[key] != undefined){
						objs[key] = tmpObjs[key]; // maybe undefined?
					}
				});

				console.log('Updating');
				console.log(objs);

				// res.json(req.body);

				m.User.update(
					{ '_id': user._id },
					{'$set' : objs},
					{multi : false},
					function(err, updated){
						console.log('Updated');
						console.log(updated);
						if(err){
							console.log('err');
							console.log(err);
						}
						res.json(req.body);
					});
			});
			
	});


	app.patch('/user/flag', function(req, res) {
		console.log("Individual user updating FLAG");

		checkUserAuth(req, res)
			.then(function(user){

				// Updating a flag for a user
				// - can never undo a flag once it is set?

				var default_flags = {
					'add/things' : false,
					'highlights/home': false
				};

				var body = req.body;

				// console.log(req.body);
				// console.log(typeof body);
				if(body.hasOwnProperty('flags') && typeof body.flags == typeof {}){
					console.log('has property');
					var changed = 0,
						newFlags = {};
					_.each(body.flags, function(value, flag){
						// console.log(flag, value);
						// Flag in default_flags?
						if(default_flags.hasOwnProperty(flag)){
							if(['true',true,'1',1].indexOf(value) !== -1){
								changed += 1;
								newFlags['flags.'+flag] = true; //new Date(); <-- update this!!! (also need to update the UI to only look for undefined or null or falsy values)
								// user.flags[flag] = true;
							}
						} else {
							console.error('--Flag ignored!!!!');
							console.error(flag, value);
						}
					});

					// console.log('changed', changed);
					// console.log(user);
					// console.log(user);

					if(changed > 0){
						// flag was tripped!
						console.log('was tripped!');
						m.User.update({_id: user._id},{'$set' : newFlags}, function(err, newUser){
							if(err){
								console.error(err);
								res.status(500);
								res.json(false);
								return;
							}
							// All good, flag saved for user!
							// console.log('Updated Flag ok!');
							// console.log(newUser);
							res.json(true);
						});
					} else {
						// no flags matched
						console.log('no flags matched');
						res.status(404);
						res.json(false);
					}

					return;
				} else {
					// no flags property set
					console.log('no flags property set');
					res.status(404);
					res.json(false); // no flag to set
				}

			});
			
	});


	app.get('/users/search/username/:username', function(req, res) {
		console.log("Finding User by username");

		checkUserAuth(req, res)
			.then(function(user){

				// Finding for this user, or another player?
				var conditions = {
					username_lowercase: new RegExp('^'+req.params.username.trim().toLowerCase(), "i")
				};
				var fields = '_id profile username __v', // null = all fields
					options = {
						skip: req.query['$skip'] || 0, // skip
						limit: req.query['$top'] || null, // limit
						sort: {_id : -1}
					};
				if(req.query['$filter']){
					// conditions = {
					// 	'$and' : [conditions, JSON.parse(req.query['$filter'])]
					// };
				}

				var findResult = Q.defer();
				m.User.find(conditions,fields,options)
				.populate('media')
				.exec(function (err, results) {
					if (err){ // TODO handle err
						console.log('alt_models error');
						return;
					}
					findResult.resolve(results);
				});

				var countResult = Q.defer();
				m.User.count(conditions, function (err, count) {
					if(err){
						console.log('Err 238947');
					}
					countResult.resolve(count);
				});

				Q.all([findResult.promise, countResult.promise])
					.spread(function(results, totalResults){
						res.json({
							results: results,
							total: totalResults
						});
					});

			});
	});


	app.post('/forgot', function(req, res) {
		console.log("Forgot password request");

		// request.post('https://wehicleapp.com/forgot/alternate', {form: {email: req.body.email, more: "here"}},function (err, response, body) {
		//   if (!err && response.statusCode == 200) {
		//     // console.log(body) // Print the google web page.
		//   }
		//   console.log(err);
		//   console.log('body', body);
		//   console.log(typeof body);
		//   res.json({
		//   	complete: true,
		//   	msg: body
		//   });
		// })
		

	});


	app.post('/user/username', function(req, res) {
		console.log("Trying to register a username (only allowed 1 time!)");

		checkUserAuth(req, res)
			.then(function(User){

				// if(typeof User.username == "string"){
				// 	// Not allowed
				// 	console.log('Already got a username!');
				// 	res.json({
				// 		code: 201,
				// 		msg: 'You already have a username: ' + User.username,
				// 		username: User.username
				// 	});
				// 	return;
				// }

				var username_min_length = 4,
					username_max_length = 30,
					invalid_usernames = [
						'undefined',
					],
					username = req.body.username.toString().trim(),
					username_lowercase = username.toLowerCase();

				// Disallowed?
				if(invalid_usernames.indexOf(username_lowercase) !== -1){
					res.json({
						code: 401,
						msg: "Username is disallowed"
					});
					return;
				}

				// Long enough?
				if(username_lowercase.length < username_min_length){
					res.json({
						code: 401,
						msg: "Username must be at least " + username_min_length + 'characters'
					});
					return;
				}

				// Too long?
				if(username_lowercase.length > username_max_length){
					res.json({
						code: 401,
						msg: "Username cannot be more than " + username_max_length + 'characters'
					});
					return;
				}

				// Saving a new username
				// - has a "unique" index
				User.username = username;
				User.username_lowercase = username_lowercase;

				User.save(function(err, newUser){
					if(err){
						// get the type of error?
						console.error(err);
						res.json({
							code: 401,
							msg: "Sorry, username taken!!"
						});
						return;
					}

					res.json({
						code: 200,
						msg: "Username saved!",
						username: newUser.username
					});

				});

			});
		

	});

	app.patch('/user', function(req, res) {
		console.log("Patching user's Profile");

		checkUserAuth(req, res)
			.then(function(User){

				
				var body = req.body;
				if(body.hasOwnProperty('profile_name')){
					User.profile.name = body.profile_name;
				}

				User.save(function(err, newUser){
					if(err){
						console.log('Failed updating newGame');
						res.status(500);
						res.json(false);
						console.log(err);
						return;
					}
					res.json(newUser);
				});

			});
			
	});

	app.post('/feedback', function(req, res) {
		console.log("Receiving feedback from a logged-in user");

		checkUserAuth(req, res)
			.then(function(user){
				// Add feedback

				// User can have a bunch of Bank Accounts, but only 1 (the most recently added) actually gets used (for now)
				var Feedback = new m.Feedback({
					user_id: user._id,
					text: req.body.text,
					indicator: req.body.indicator
				});

				Feedback.save(function(err, bank){
					if(err){
						console.log('Failed saving Feedback');
						res.status(500);
						res.json(false);
						return;
					}

					// Saved Feedback from user
					res.json(bank);

				});

			});
		

	});

	app.post('/signup', function(req, res) {
		// Create a new user and creates a "Me" player
		// - expecting the person to have a unique code to register with!
		console.log("Signup POSTed to");

		var email = req.body.email.toString().toLowerCase();
		// var code = tmpObjs.code;
		var password = req.body.password.toString();
		var profile_name = req.body.profile_name || '';
		profile_name = profile_name.toString().trim();

		// Test email address
	    if(!validateEmail(email)){
	    	console.log('Email failed');
	    	res.json({
				complete: false,
				msg: 'bademail'
			});
	    	return;
	    }


	    console.log('Email OK');

	    // Create account (it will fail if the email already exists)

	    try {
			var User = new m.User({
				profile: {
					name: profile_name
				},
				email: email,
				password: password,
				// role: "player",
				active: 1
			});
		} catch(err){
			console.error(err);
			res.status(500);
			return;
		}

		try {

			User.save(function(err, newUser){
				if(err){
					console.log('Failed creating user');
					console.log(err.code);
					if(err.code == 11000){
						// Duplicate key error
						res.json({
							complete: false,
							msg: 'duplicate'
						});
						return;
					}
					res.json({
						complete: false,
						msg: 'unknown'
					});
					return;
				}

				console.log('User has signed up');
				console.log(newUser);
				console.log(email);

				// tell Nick about the signup
				models.email.send({
					to: 'nicholas.a.reed@gmail.com',
					from: 'founders@wehicleapp.com',
					subject: 'New InternalApp Signup',
					text: email + ' just signed up for InternalApp!'
				});

				// Return to user
				res.json({
					complete: true,
					email: email
				});

				
				// Create default Push Settings for user
				var PushSetting = new m.PushSetting({
					user_id : newUser._id
				});
				// Insert
				PushSetting.save(function(err, newPushSetting){
					if(err){
						console.error('PushSetting error');
						console.error(err);
						return;
					}

					// Saved PushSetting OK
					console.log('Saved PushSetting');

				});



			});
		
		} catch(err2){
			console.log('failed err2');
			console.error(err2);
			res.status(500);
			res.json(false);
		}
			
	});

	app.get('/confirm_signup', function(req, res) {
		console.log("Confirm email address used for signup");
		
		// should accept a token and use it to verify an email address for somebody
			
	});

	app.post('/login/2', function(req, res) {
		console.log("Login v2");

		var body = _.clone(req.body);
		if(body.hasOwnProperty('email') && body.hasOwnProperty('password')){
			// Find the User
			m.User.find(
				{ 
					'email': body.email.toString().toLowerCase(),
					// 'password' : body.password.toString()
				},
				function(err, users) {
					// console.log(items);
					if(!users || typeof users == undefined || users.length < 1){
						// defer.resolve(false);
						res.status(401);
						res.json('Invalid user');
						return;
					}

					// Found 'em
					var User = users[0];

					// Test password (bcrypt hashes)
					User.comparePassword(body.password.toString(), function(err, isMatch){

						if(isMatch !== true){
							console.log('Not isMatch!');
							res.status(401);
							res.json('Invalid user');
							return;
						}

						// Build token
						var access_token = default_serializer.stringify([
							User._id, 
							+new Date, 
							'v0.1']);

						// Return token to user
						res.json({
							code: 200,
							token: access_token
						});

					});

				}
			);
		} else {
			res.json(401);
			res.json('Invalid user');
		}
			
	});

	app.post('/login', function(req, res) {
		console.log("Login");
		checkUserAuth(req, res)
			.then(function(user){
				if(user){
					res.json(true);
				} else {
					res.json(401);
					res.json('Invalid user');
				}
			});
			
	});

	app.post('/user/loginas/:user_id', function(req, res) {
		console.log("Login As");
		checkUserAuth(req, res)
			.then(function(user){
				
				if(user._id.toString() != '529c02f00705435badb1dff4'){ // zane
					res.status(404);
					res.send(false);
					return;
				}

				var user_id = ObjectID(req.params.user_id);

				// Find the user and return them
				m.User.findOne({_id: user_id})
				.exec(function(err, User){
					if(err){
						console.error(err);
						res.status(500);
						res.json(false);
						return;
					}

					// Return login info
					console.log('Login as', User.email);
					res.json(User);

				});


			});
			
	});

	app.get('/users', function(req, res) {
		console.log("Finding all users, so developers can login with one");

		checkUserAuth(req, res)
			.then(function(user){

				if(user._id.toString() != '529c02f00705435badb1dff4'){ // zane
					// res.status(404);
					res.json([]);
					return;
				}

				// Get all users
				var conditions = {},
					fields = null, // null = all fields
					options = {
						skip: req.query['$skip'] || 0, // skip
						limit: req.query['$top'] || null, // limit
						sort: {_id : -1}
					};
				if(req.query['$filter']){
					conditions = {
						'$and' : [conditions, JSON.parse(req.query['$filter'])]
					};
				}
				var findResult = Q.defer();
				m.User.find(conditions,fields,options, function (err, results) {
					if (err){ // TODO handle err
						console.log('alt_models error');
						return;
					}
					findResult.resolve(results);
				})

				var countResult = Q.defer();
				m.User.count(conditions, function (err, count) {
					if(err){
						console.log('Err 238947');
					}
					countResult.resolve(count);
				})

				Q.all([findResult.promise, countResult.promise])
					.spread(function(results, totalResults){
						res.json({
							results: results,
							total: totalResults
						});
					});
			});

	});


}