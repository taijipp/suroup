'use-strict';

const fs = require('fs');
const path = require('path');
const dataDirectory = __dirname+'/../../'+(process.env.data_directory || 'data');

module.exports = {
    addCallback(accessToken, data) {
		fs.readdirSync(dataDirectory).forEach(f => fs.rmSync(`${dataDirectory}/${f}`));
        fs.writeFileSync(filePath(accessToken),
            JSON.stringify({accessToken, ...data}, null, 2), 'utf-8')
    },

    removeCallback(accessToken) {
        fs.unlinkSync(filePath(accessToken))
    },

    getCallbacks() {
        return fs.readdirSync(dataDirectory).map(file => {
            const json = fs.readFileSync(path.join(dataDirectory, file), 'utf-8')
            return JSON.parse(json)
        })
    }
}

function filePath(accessToken) {
    return path.join(dataDirectory, `${accessToken}.json`)
}
