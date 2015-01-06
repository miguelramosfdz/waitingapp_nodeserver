
var _ = require('underscore'),
	serializer = require('serializer'),
	nunjucks = require('nunjucks'),
	Q = require('q');

exports.serializer = serializer.createSecureSerializer(config.get('serialize_key'), config.get('serialize_secret')); // encryption key, signing key




// Sendgrid (email gateway)
var sendgrid_username = config.get('sendgrid_username'),
	sendgrid_password = config.get('sendgrid_password');
if(process.env.SENDGRID_USERNAME){
	sendgrid_username = process.env.SENDGRID_USERNAME;
	sendgrid_password = process.env.SENDGRID_PASSWORD;
} else {
	console.log('Using config.get for sendgrid');
}

var sendgrid = require('sendgrid')(sendgrid_username, sendgrid_password);


// Send with us Email Templates (another way of emailing
var swu = require('sendwithus')
var swu_api = swu(config.get('sendwithus_api_key'));

exports.email = {
	swu: {
		send: function(){
			// send via SendWithUs template
			swu_api.send({
				email_id: 'tem_L9FMpAqRKChfcCHDkzyhqA',
				recipient: { 
					address: newSendObj.to
				},
				sender: {
					address: newSendObj.from
				},
				email_data: {
					first_name: 'your name here',
					button_text: 'boring text...'
				}
			});
		}
	},
	send: function(sendObj){

		// console.log('passed in sendObj', sendObj);

		var newSendObj = {
			to: '',
			from: '',
			subject: '',
			text: '',
			html: ''
		};
		Object.keys(newSendObj).forEach(function(key){
			if(sendObj[key] !== undefined){
				newSendObj[key] = sendObj[key];
			}
		});

		// SendWithUs template?
		if(sendObj.swu_template){

			swu_api.send({
				// no "subject" included, exists in template
				email_id: sendObj.swu_template,
				recipient: { 
					address: newSendObj.to
				},
				sender: {
					address: newSendObj.from
				},
				email_data: sendObj.data
			},function(err, data){
				if (err) {
			        console.log('SendWithUs error', err, err.statusCode);
			    } else {
			    	console.log('SendWithUs Result');
			        console.log(data);
			    }
			});
			return;
		}

		// Using a local template?
		var onTemplate = Q.defer();
		if(sendObj.template){
			// HTML
			nunjucks.render('emails/' + sendObj.template + '/html.tpl', sendObj.data, function(err, html){
				if(err){
					console.error('building html email error:', err);
				}
				// Text
				nunjucks.render('emails/' + sendObj.template + '/text.tpl', sendObj.data, function(err, text){
					if(err){
						console.error('building text email error:', err);
					}
					newSendObj.html = html;
					newSendObj.text = text;
					onTemplate.resolve();
				});
			});
		} else {
			onTemplate.resolve();
		}
		
		onTemplate.promise.then(function(){

			console.log('Sending Email');
			// console.log(newSendObj);
			// return;

			// Send!
			sendgrid.send(newSendObj, function(err, json) {
				if (err) { 
					console.error('sendgrid error1');
					return console.error(err); 
				}
				console.log('sendgrid result');
				console.log(json);
				console.log('sendgrid error:', err);
			});

		});
	},
	signup_email: function(newUser){
		// 

		// send via swu
		models.email.send({
			to: newUser.email, //config.get('admin_email_from'),
			from: config.get('admin_email_from'),
			swu_template: 'tem_rEmwEZKTUjizcuMyR72CiK',
			data: {
				config: config.get(),
				user: newUser
			}
		});
	}
};


// Stripe (payments, credit cards, bank accounts, etc.)
var stripe2 = require('stripe'),
	stripe = new stripe2(); 
stripe.setApiKey(config.get('stripe_api_key_secret_' + config.get('stripe_mode')));
exports.stripe = stripe;

// Mailgun
var Mailgun = require('mailgun-js');
exports.mailgun = new Mailgun({apiKey: config.get('mailgun_key_secret'), domain: config.get('mailgun_domain')});

// Firebase
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");
exports.Firebase = Firebase;
exports.Firebase.tokenGenerator = new FirebaseTokenGenerator(config.get('firebase_secret'));
// Example: var token = tokenGenerator.createToken({uid: "1", some: "arbitrary", data: "here"});
