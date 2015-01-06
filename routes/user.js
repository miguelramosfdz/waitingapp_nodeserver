
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId,
	serializer = require('serializer'),
	request = require('request'),
	async = require('async'),
	crypto = require('crypto'),
	default_serializer = serializer.createSecureSerializer(config.get('serialize_key'), config.get('serialize_secret')); // encryption key, signing key

var FB = require('fb');

var google = require('googleapis');
var plus = google.plus('v1');
var OAuth2 = google.auth.OAuth2;

module.exports = function(app) {
  
	// PUBLIC
	app.get('/u/:user_id', function(req, res) {
		console.log("Public User Profile");

		// Remove user email/password/etc from response

		var user_id = req.params.user_id;

		// Get all my player id's too
		// - easier than asking if I belong to everything
		m.User.findOne({
			_id: ObjectID(user_id)
		})
		.populate('profilephoto')
		.exec(function(err, User){
			if(err){
				console.log('Err: unable to find user');
				res.status(500);
				res.json(false);
				return;
			}

			console.log('Got user');
			
			if(!User){
				res.status(404);
				res.json(false);
				return;
			}

			var tmpUser = User.toJSON();

			var allowed = [
				'_id',
				// 'username',
				'profilephoto',
				'profile',
				'admin'
			];

			var returnObj = {};
			_.each(allowed, function(key){
				if(tmpUser[key] != undefined){
					returnObj[key] = tmpUser[key];
				}
			});

			// Get the user's media
			var mediaConditions = {
				user_id: user_id,
				active: true
			};
			m.Media.find(mediaConditions)
			.exec(function(err, media){
				if(err){
					errorhandler(err, res);
					return;
				}

				console.log(media);

				// Render User+Media
				res.render("user", { 
					pageTitle: config.get('app_name'), 
					user: User,
					media: media
				});
			});
			
		});

		

	});



	// API

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

	app.post('/user/testpush', function(req, res) {
		checkUserAuth(req, res)
			.then(function(user){
				// Add feedback

				console.log('Triggering a Push Notification');
				setTimeout(function(){
					m.PushNotification.pushToUser(user._id, {
						ios_title: 'Testing Push Notification',
						title: 'Testing Push Notification',
						message: 'Message Body Here',
						payload: {type: 'testpush'}
					}, 'testpush', {});
				},5000);

				res.json(true);

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
				.populate('profilephoto')
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
						'profile',
						'admin'
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

				user.populate('profilephoto',function(){
					var allowed = [
						'_id',
						'email',
						'admin',
						// 'password',
						// 'friends',
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
				})

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
					'highlights/home': false,
					'localinvite/home/v/1' : false
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


		// req.assert('email', 'Please enter a valid email address.').isEmail();

		// var errors = req.validationErrors();
		var errors = null;

		// if (errors) {
		//   req.flash('errors', errors);
		//   return res.redirect('/forgot');
		// }

		async.waterfall([
			function(done) {
				console.log('crypto');
				crypto.randomBytes(16, function(err, buf) {
					var token = buf.toString('hex');
					done(err, token);
				});
			},
			function(token, done) {
				console.log('find user');
				  m.User.findOne({ email: req.body.email.toLowerCase() }, function(err, user) {
				    if (!user) {
				      // req.flash('errors', { msg: 'No account with that email address exists.' });
				      // res.status(401);
				      // res.json({
				      // 	msg: "No account with that email address exists"
				      // });

				  		// No user found, trying not to leak additional information too easily
						res.json({
							noemail: true,
							complete: true
						});

				      return;
				      // return res.redirect('/forgot');
				    }

				    user.resetPasswordToken = token;
				    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

				    user.save(function(err) {
				      done(err, token, user);
				    });
				  });
			},
			function(token, user, done) {

				console.log('send email');

				// Send reset email
				models.email.send({
					to: user.email,
					from: config.get('admin_email_from'),
					subject: 'Reset your password on ' + config.get('app_name'),
					text: 'You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n' +
				      'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
				      config.get('server_root') + 'reset/' + token + '\n\n' +
				      'If you did not request this, please ignore this email and your password will remain unchanged.\n'
				});

				console.log('reset url: ',config.get('server_root') + 'reset/' + token);

				done(null, 'done');

			}
		], function(err) {
			console.log('done');
			if (err){
				console.error(err);
				res.status(500);
				res.json(false);
				return;
			};
			// res.send("ok");
			// res.redirect('/forgot');
			res.json({
				complete: true
			});
		});

	});

	
	app.get('/reset/:token', function(req, res) {

	  m.User
	    .findOne({ resetPasswordToken: req.params.token })
	    .where('resetPasswordExpires').gt(Date.now())
	    .exec(function(err, user) {
	      if (!user) {
	        res.send('Password reset token is invalid or has expired.');
	        return;
	      }
	      res.render('reset', {
	        title: 'Password Reset'
	      });
	    });
	});


	app.post('/reset/:token', function(req, res) {

	  async.waterfall([
	    function(done) {
	      m.User
	        .findOne({ resetPasswordToken: req.params.token })
	        .where('resetPasswordExpires').gt(Date.now())
	        .exec(function(err, user) {
	          if (!user) {
	            req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
	            return res.redirect('back');
	          }

	          user.password = req.body.password;
	          user.resetPasswordToken = undefined;
	          user.resetPasswordExpires = undefined;

	          user.save(function(err) {
	            if (err) return next(err);
	            done(err, user);
	            // req.logIn(user, function(err) {
	            //   done(err, user);
	            // });
	          });
	        });
	    },
	    function(user, done) {

			models.email.send({
				to: user.email,
				from: config.get('admin_email_from'),
				subject: 'Your '+ config.get('app_name') +' password has been changed',
				text: 'Hello,\n\n' +
          			'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
			});

			done(null);

	      // var smtpTransport = nodemailer.createTransport('SMTP', {
	      //   service: 'SendGrid',
	      //   auth: {
	      //     user: secrets.sendgrid.user,
	      //     pass: secrets.sendgrid.password
	      //   }
	      // });
	      // var mailOptions = {
	      //   to: user.email, //'nick@thehandyapp.com',
	      //   from: 'founders@wehicleapp.com',
	      //   subject: 'Your Wehicle password has been changed',
	      //   text: 'Hello,\n\n' +
	      //     'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
	      // };
	      // smtpTransport.sendMail(mailOptions, function(err) {
	      //   res.send('Success! Your password has been changed.');
	      //   done(err);
	      // });
	    }
	  ], function(err) {
	    if (err){
	    	console.error(err);
	    	res.send('Failed updating your password');
	    	return;
	    }
	    res.send('Success! Your password has been changed.');

	  });
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
				if(body.hasOwnProperty('profile_bio')){
					User.profile.bio = body.profile_bio;
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

				Feedback.save(function(err, newFeedback){
					if(err){
						console.log('Failed saving Feedback');
						res.status(500);
						res.json(false);
						return;
					}

					// Saved Feedback from user
					res.json(newFeedback);



					// Push Notify Nick
					m.User.findOne({email: config.get('admin_email_from')}, function(err, Nick){
						console.log('Found NICK');
						if(err){
							console.log('No Nick');
							console.error(err);
							return;
						}
						m.PushNotification.pushToUser(user._id, {
							ios_title: 'New feedback from: ' + user.email,
							title: 'New feedback from: ' + user.email,
							message: user.email,
							payload: {type: 'new_feedback', id: newFeedback._id}
						}, 'new_feedback', {});

					});


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

	    // Check username
	    var username,
	    	username_lowercase;
	    if(req.body.username){
	    	username = req.body.username;
	    	username_lowercase = req.body.username.toString().toLowerCase();
	    }

	    console.log('Email OK');

	    // Create account (it will fail if the email already exists)

	    var data = {
			profile: {
				name: profile_name
			},
			email: email,
			password: password,

			username: username,
			username_lowercase: username_lowercase,

			active: 1
		};

		m.User.signup(data, res);
			
	});

	app.get('/confirm_signup', function(req, res) {
		console.log("Confirm email address used for signup");
		
		// should accept a token and use it to verify an email address for somebody
			
	});

	app.post('/login', function(req, res) {
		console.log("Login");

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
							_id: User._id,
							token: access_token,
							websocket: models.Firebase.tokenGenerator.createToken({uid: User._id.toString()},{expires: moment().add(1,'year').unix()})
						});

					});

				}
			);
		} else {
			res.json(401);
			res.json('Invalid user');
		}
			
	});

	app.post('/login/facebook', function(req, res) {
		console.log("Login with Facebook token");

		var body = _.clone(req.body);

		FB.api('me', {
		    // client_id: config.get('fb_app_id'),
		    appSecret: config.get('fb_app_secret'),
		    // grant_type: 'fb_exchange_token',
		    access_token: body.token
		}, function (fbRes) {
		    if(!fbRes || fbRes.error) {
		        console.log(!fbRes ? 'error occurred' : fbRes.error);
		        errorhandler(fbRes, res);
		        return;
		    }

		    // Get our facebook user id
			m.User.findOne(
				{ 
					'$or' : [
						{'fb_user.id': fbRes.id},
						{email: fbRes.email}
					]
					// 'password' : body.password.toString()
				},
				function(err, User) {
					if(err){
						errorhandler(err, res);
						return;
					}

					// Found any existing user?
					// - if NO: new signup! 
					if(!User){
					    var data = {
							profile: {
								name: fbRes.name
							},

							fb_token: body.token, // not storing expiration at the moment?
							fb_user: fbRes,
							fb_friends: null,

							email: fbRes.email.toLowerCase(),
							password: 'facebook', // bcrypt will never match this

							active: 1
						};

						// Signup
						m.User.signup(data, res);

						// Check Facebook friends
						// - auto-friend any FB friends already on the service
						// - 

						return;
					}


					// Already registered, log them in easily

					// Build token
					var access_token = models.serializer.stringify([
						User._id, 
						+new Date, 
						'v0.1']);

					// Return token to user
					res.json({
						code: 200,
						_id: User._id,
						token: access_token,
						websocket: models.Firebase.tokenGenerator.createToken({uid: User._id.toString()},{expires: moment().add(1,'year').unix()})
					});

					// Update the facebook user
					// - update their facebook friend list as well
					m.User.updateFacebookFriends(User, body.token);

				}
			);

		});
			
	});

// var request = require('request');
// // kid = the key id specified in the token
// function getGoogleCerts(kid, callback) {
//     request({uri: 'https://www.googleapis.com/oauth2/v1/certs'}, function(err, response, body){
//         if(err && response.statusCode !== 200) {
//             err = err || "error while retrieving the google certs";
//             console.log(err);
//             callback(err, {})
//         } else {
//             var keys = JSON.parse(body);
//             callback(null, keys[kid]);
//         }

//     });
// }

// var googleIdToken = require('google-id-token')
// var parser = new googleIdToken({ getKeys: getGoogleCerts });

	app.post('/login/gplus', function(req, res) {
		console.log("Login with Google+ token");

		var body = _.clone(req.body);
		console.log(body);


		var oauth2Client = new OAuth2(
			config.get('gplus_server_client_id'), 
			config.get('gplus_server_client_secret'), 
			config.get('server_root')
		);


		// console.log('parser decoding');

		// parser.decode(body.token, function(err, token) {
		//     if(err) {
		//         console.log("error while parsing the google token: " + err);
		//     } else {
		//         console.log("parsed id_token is:\n" + JSON.stringify(token));
		//     }
		// });

		// return;

		// // Retrieve tokens via token exchange explained above or set them:
		// oauth2Client.tokenInfo(body.token, function(err, tokens) {
		// 	if(err){
		// 		console.log('Failed getToken');
		// 		errorhandler(err, res);
		// 		return;
		// 	}

		// 	console.log('Got tokens');
		// 	console.log(tokens);

		// 	errorhandler('ok');
		// 	return;

		// 	oauth2Client.setCredentials(tokens);

		// 	plus.people.get({ userId: body.gplus_user_id, auth: oauth2Client }, function(err, gplusUser) {
		// 		console.log(err);
		// 		console.log(gplusUser);
		// 	});

		// 	errorhandler('might have succeeded', res);


		// });

		// return;
		oauth2Client.setCredentials({
		  access_token: body.token
		  // refresh_token: body.refresh_token
		});

		plus.people.get({ userId: 'me', auth: oauth2Client }, function(err, gplusUser) {
		    if(err || !gplusUser){
		        errorhandler(err, res);
		        return;
		    }

		    // Get user's email from gplus
		    console.log('Response (GooglePlus user)');
		    console.log(gplusUser);

		    var email;

		    // Attempt to get this user's actual email (that we SHOULD have access to via our access_token)
		    // - seems to be broken on android, unable to have "email" permission from server somehow???
		    try {
		    	email = gplusUser.emails[0].value;
		    }catch(err){
		    	// Failed signing up gplus user, failed finding email

		    	console.error("Failed finding valid email for user (scope requested did not include email)");

		    	// ONLY DOING THIS TEMPORARILY!
		    	// - we save the gplus_id, and then "trust" that whatever email is submitted, is a valid one
		    	// - do this until we figure out how to authenticate more than just the fucking Google+ ID for a user with Scoping
		    	email = body.email || '';

		    	// errorhandler(err, res, 415);
		    	// return;
		    }

		    email = email.toString().trim().toLowerCase();

		    console.log('email:', email);

		    // Get our gplus user id
		    var userConditions = {};
		    if(validateEmail(email)){
		    	userConditions = {
		    		email: email
		    	};
			} else {
				// No email?
				// - big problem for now, we NEED a valid email after making the request to google's auth api
				errorhandler('Missing email for user, NOT available from auth api', res);
				return;

				// userConditions = { 
				// 	'gplus_user.id': gplusUser.id
				// };
			}
			m.User.findOne(userConditions, function(err, User) {
					if(err){
						errorhandler(err, res);
						return;
					}

					// Found any existing user?
					// - if NO: new signup! 
					if(!User){
						console.log('Creating a new user from Gplus account');

					    var data = {
							profile: {
								name: gplusUser.displayName
							},

							gplus_token: body.token, // not storing expiration at the moment?
							gplus_user: gplusUser,

							email: email,
							password: 'gplus', // bcrypt will never match this

							active: 1
						};
						m.User.signup(data, res);
						return;
					}


					// Already registered, log them in easily

					// Build token
					var access_token = models.serializer.stringify([
						User._id, 
						+new Date,
						'v0.1']);

					// Return token to user
					res.json({
						code: 200,
						_id: User._id,
						token: access_token,
						websocket: models.Firebase.tokenGenerator.createToken({uid: User._id.toString()},{expires: moment().add(1,'year').unix()})
					});

					// // Update their friend list too
					// FB.api('me/friends', {
					//     appSecret: config.get('fb_app_secret'),
					//     access_token: body.token
					// }, function (friendRes) {
					// 	if(friendRes.error || !friendRes.data){
					// 		console.error('Failed updating user friends1');
					// 		console.error(friendRes.error);
					// 		return;
					// 	}
					// 	console.log('friendRes');
					// 	console.log(friendRes);

					// 	User.fb_friends = friendRes.data; // [] array of friend ids
					// 	User.save(function(err, updatedUser){
					// 		if(err){
					// 			console.error('Failed updating user friends2');
					// 			console.error(err);
					// 			return;
					// 		}

					// 		console.log('updated friends ok');
					// 	});
					// });


				}
			);

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



	app.post('/logut', function(req, res) {
		
		// Clears the Android/iOS tokens for a user
		// - so we stop sending Push Notifications to them

		checkUserAuth(req, res)
			.then(function(user){

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