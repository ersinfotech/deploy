const shell = require('shelljs')
const deployPath = require('./deployPath')

const exist = shell.test('-f', deployPath)
if (!exist) {
  shell.cp(__dirname + '/.deploy.js', deployPath)
  console.log(`created ${deployPath}`)
}
