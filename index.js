#!/usr/bin/env node

const program = require('commander')
const { Select, Password } = require('enquirer')
const _ = require('lodash')
const shell = require('shelljs')
const Promise = require('bluebird')
const deployPath = require('./deployPath')

const config = require(deployPath)

program.command('app [name]').action(async name => {
  if (!name) {
    try {
      const prompt = new Select({
        message: 'Select an app to restart',
        choices: _.keys(config.app),
      })
      name = await prompt.run()
    } catch (error) {
      return
    }
  }
  const app = config.app[name]
  if (!app) {
    console.error(`${name} not exists`)
    return
  }
  for (const [hostName, host] of Object.entries(config.host)) {
    shell.exec(`ssh ${host} pm2 startOrRestart ${app}`)
    console.log(`${host} ${name} startOrRestart`)
  }
})

program.command('run [command...]').action(command => {
  for (const [hostName, host] of Object.entries(config.host)) {
    console.log(`${host} run output:`)
    shell.exec(`ssh ${host} ${command.join(' ')}`)
    console.log('')
  }
})

program.command('sudo [command...]').action(async command => {
  const prompt = new Password({
    message: '[sudo] password:',
  })
  const password = await prompt.run()
  for (const [hostName, host] of Object.entries(config.host)) {
    console.log(`${host} sudo output:`)
    const { stdout } = shell.exec(
      `echo ${password} | ssh -tt ${host} sudo ${command.join(' ')}`,
      { silent: true }
    )
    console.log(
      stdout
        .replace(/^.*[\r\n]/, '')
        .replace(/^.*[\r\n]/, '')
        .replace(/^.*[\r\n]/, '')
        .trim()
    )
    console.log('')
  }
})

program.command('nginx').action(async () => {
  const prompt = new Password({
    message: '[sudo] password:',
  })
  const password = await prompt.run()
  for (const [hostName, host] of Object.entries(config.host)) {
    shell.exec(
      `echo ${password} | ssh -tt ${host} sudo systemctl restart nginx`,
      { silent: true }
    )
    console.log(`${host} nginx restart`)
  }
})

program.parse(process.argv)
