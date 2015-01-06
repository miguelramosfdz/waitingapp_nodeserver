// set up mongoose
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var SHA3 = require('sha3');
var crypto = require('crypto');

var Q = require('q'),
  _ = require('underscore');

var schema = Schema({

  key: Object,
  str: String,
  obj: Object,

  created: { type: Date, default: Date.now },
  modified: { type: Date, default: Date.now }

});

var Model = mongoose.model('key_value_stores', schema);


Model.hashAndStore = function(value){

  var def = Q.defer();

  process.nextTick(function(){

    // MD5 hash
    var d = crypto.createHash('md5');
    d.update(value);
    var hexValue = d.digest('hex');

    // // Generate 512-bit digest.
    // var d = new SHA3.SHA3Hash(256); //256);
    // d.update(value);
    // var hexValue = d.digest('hex');

    var newModel = new Model({
      key: hexValue,
      str: value
    });

    newModel.save(function(err, theNewModel){
      if(err){
        def.reject(err);
      }

      def.resolve(hexValue);
    });

  });

  return def.promise;

};

Model.getHashedValue = function(hashedKey){

  var def = Q.defer();

  Model.findOne({
    key: hashedKey
  },null)
  .exec(function(err, returnObj){
    if(err){
      console.log('err', err);
      def.reject(err);
      return;
    }
    def.resolve(returnObj.str);
  });

  return def.promise;

};

exports.Model = Model;
