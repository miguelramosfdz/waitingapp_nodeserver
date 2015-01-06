
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId;

module.exports = function(app) {
  
	app.post('/webhook/mailgun', function(req, res) {
		console.log("Mailgun URL POSTed to");

		var body = req.body;

	    if (!models.mailgun.validateWebhook(body.timestamp, body.token, body.signature)) {
	      console.error('Request came, but not from Mailgun');
	      res.send({ error: { message: 'Invalid signature. Are you even Mailgun?' } });
	      return;
	    }

	    console.log("Passed Mailgun validation func");

	    // Should move to a queue...
		res.send("OK");

	    console.log(body.recipient);

	    // Look up the recipient email in our database
	    var recipient = body.recipient.split('@')[0].toString().toLowerCase();

	    m.Mailbox.findOne({
	    	email: recipient
	    })
	    .populate('todo_id invoice_id')
	    .exec(function(err, Mailbox){
	    	if(err){
	    		console.error('Unable to find recipient email!');
	    		return;
	    	}

	    	if(!Mailbox){
	    		console.error('Mailbox does not exist');
	    		res.send('Failed finding Mailbox');
	    		return;
	    	}

	    	console.log(Mailbox);

	    	// I'm included in the mailbox?
	    	// - happens in the todo/invoice for now

	    	// check type of Mailbox
	    	// - todo, invoice
	    	switch(Mailbox.type){
	    		case 'todo':

					// Prepare TodoContent data
					var TodoContent = new m.TodoContent();

					TodoContent.active = true;
					// TodoContent.user_id = user._id; // should be linked to a user?
					TodoContent.todo_id = Mailbox.todo_id;

					TodoContent.type = 'email'; // text? ... what about attachments?
					TodoContent.details = {
						from: body.sender,
						text: body['stripped-text']
					};

					// Save Todo
					TodoContent.save(function(err, newTodoContent){
						if(err){
							console.log('newTodoContent saving error');
							console.log(err);
							res.status(500);
							res.json(false);
							return;
						}

						console.log('Saved new newTodoContent');

						// Create update/action
						// - only supporting "text" for now!
						var group_key = guid(); // should get a better group key?
						var Action = new m.Action({
							  type: 'todo_new_email', //{ type: String }, // joined, new_nemesis, etc.
							  details: {
							  	text: body['stripped-text'],
							  	from: body.sender,

							  	todo_id: Mailbox.todo_id._id
							  },

							  group_key: group_key,

							  // user_id: user._id, //{ type: ObjectId, ref: 'users' }, // "affected"

							  todo_id: Mailbox.todo_id._id,

							  user_ids: _.compact([Mailbox.todo_id.user_id, Mailbox.todo_id.assigned_id, Mailbox.todo_id.owner_id]),
							  
						});
						Action.save(function(err, newAction){
							if(err){
								console.error('Error saving Action: 2394898h: ', err);
								return;
							}
							console.log('Action saved OK');
						});

						// Update remote users
						m.User.updateRemote([Mailbox.todo_id.user_id, Mailbox.todo_id.assigned_id, Mailbox.todo_id.owner_id]);

						// Push Notify them too
						_.compact([Mailbox.todo_id.user_id, Mailbox.todo_id.assigned_id, Mailbox.todo_id.owner_id]).forEach(function(tmpId){
							m.PushNotification.pushToUser(tmpId, {
								ios_title: body.sender + ' updated todo: ' + Mailbox.todo_id.title,
								title: body.sender + ' updated todo: ' + Mailbox.todo_id.title,
								message: 'moments ago',
								payload: {type: 'todo_content_added', id: Mailbox.todo_id._id}
							}, 'todo_content_added', {todo_id: Mailbox.todo_id._id});
						});

						// Send emails
						// - like a mailing list
						Mailbox.todo_id.included.forEach(function(theEmail){
							if(theEmail == body.sender.toString().toLowerCase()){
								console.log('Not sending to same person');
								return;
							}

							// send email
							var data = {
								'h:In-Reply-To': Mailbox.mailgun_id,
								from: 'OddJob <'+Mailbox.email+'@' + config.get('mailgun_domain') + '>',
								to: theEmail,
								subject: Mailbox.mailgun_subject,
								text: body['stripped-text'] // handle more types! media, timeframes, etc.
							};

							console.log('email Data');
							console.log(data);

							models.mailgun.messages().send(data, function (error, body) {
								if(err){
									errorhandler(err, res);
									return;
								}

								console.log('send email OK');
							  	console.log(body);

							  	// res.json(true);

							});

						});


					});


	    			break;

	    		case 'invoice':

					// Prepare InvoiceContent data
					var InvoiceContent = new m.InvoiceContent();

					InvoiceContent.active = true;
					// InvoiceContent.user_id = user._id; // should be linked to a user?
					InvoiceContent.invoice_id = Mailbox.invoice_id;

					InvoiceContent.type = 'email'; // text? ... what about attachments?
					InvoiceContent.details = {
						from: body.sender,
						text: body['stripped-text']
					};

					// Save InvoiceContent
					InvoiceContent.save(function(err, newInvoiceContent){
						if(err){
							console.log('newInvoiceContent saving error');
							console.log(err);
							res.status(500);
							res.json(false);
							return;
						}

						console.log('Saved new newInvoiceContent');

						// Create update/action
						// - only supporting "text" for now!
						var group_key = guid(); // should get a better group key?
						var Action = new m.Action({
							  type: 'invoice_new_email', //{ type: String }, // joined, new_nemesis, etc.
							  details: {
							  	text: body['stripped-text'],
							  	from: body.sender,

							  	invoice_id: Mailbox.invoice_id._id
							  },

							  group_key: group_key,

							  // user_id: user._id, //{ type: ObjectId, ref: 'users' }, // "affected"

							  invoice_id: Mailbox.invoice_id._id,

							  user_ids: _.compact([Mailbox.invoice_id.to_user_id, Mailbox.invoice_id.from_user_id]),
							  
						});
						Action.save(function(err, newAction){
							if(err){
								console.error('Error saving Action: 2394898h: ', err);
								return;
							}
							console.log('Action saved OK');
						});

						// Update remote users
						m.User.updateRemote([Mailbox.invoice_id.to_user_id, Mailbox.invoice_id.from_user_id]);

						// Push Notify them too
						_.compact([Mailbox.invoice_id.to_user_id, Mailbox.invoice_id.from_user_id]).forEach(function(tmpId){
							m.PushNotification.pushToUser(tmpId, {
								ios_title: body.sender + ' updated invoice: ' + Mailbox.invoice_id.title,
								title: body.sender + ' updated invoice: ' + Mailbox.invoice_id.title,
								message: 'moments ago',
								payload: {type: 'invoice_content_added', id: Mailbox.invoice_id._id}
							}, 'invoice_content_added', {invoice_id: Mailbox.invoice_id._id});
						});

						// Send emails
						// - like a mailing list
						Mailbox.invoice_id.included.forEach(function(theEmail){
							if(theEmail == body.sender.toString().toLowerCase()){
								console.log('Not sending to same person');
								return;
							}

							// send email
							var data = {
								'h:In-Reply-To': Mailbox.mailgun_id,
								from: 'OddJob <'+Mailbox.email+'@' + config.get('mailgun_domain') + '>',
								to: theEmail,
								subject: Mailbox.mailgun_subject,
								text: body['stripped-text'] // handle more types! media, timeframes, etc.
							};

							console.log('email Data');
							console.log(data);

							models.mailgun.messages().send(data, function (error, body) {
								if(err){
									errorhandler(err, res);
									return;
								}

								console.log('send email OK');
							  	console.log(body);

							  	// res.json(true);

							});

						});


					});


	    			break;


	    		default:
	    			// res.send('OK');
	    			break;
	    	}
	    });


	});


}