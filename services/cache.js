const mongoose = require('mongoose');
const redis = require('redis');
const redisUrl = 'redis://127.0.0.1:6379';
const util = require('util');
const client = redis.createClient(redisUrl);
client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}) {
    this.useCache = true;
    this.hashKey = JSON.stringify(options.key || '');
    return this;
}

mongoose.Query.prototype.exec = async function() {
    if(!this.useCache) {
        return exec.apply(this, arguments)
    }
    const key = JSON.stringify(Object.assign({}, this.getQuery(), { collection: this.mongooseCollection.name}));
    const cacheValues = await client.hget(this.hashKey, key);
    if(cacheValues) {
      console.log("serving from cache");
      const doc = JSON.parse(cacheValues);
      return Array.isArray(doc) ?
        doc.map(d => new this.model(d)) : 
        new this.model(doc);
    }
    const results = await exec.apply(this, arguments);
    client.hset(this.hashKey, key, JSON.stringify(results));
    return results;
}

module.exports = {
    clearHash(hashKey) {
        client.del(JSON.stringify(hashKey));
    }
}