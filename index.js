#!/usr/bin/env node

const program = require('commander')
const { MultiSelect, Password } = require('enquirer')
const _ = require('lodash')
const shell = require('shelljs')
const Promise = require('bluebird')
const chalk = require('chalk')
const deployPath = require('./deployPath')
const writeEcosystem = require('./writeEcosystem')
const pkg = require('./package.json')

const config = require(deployPath)

program.version(pkg.version, '-v, --version')

program.command('app [name]').action(async name => {
  let names
  writeEcosystem(config)
  if (name) {
    const app = config.app[name]
    if (!app) {
      console.error(`${name} not exists`)
      return
    }
    names = _.castArray(name)
  } else {
    try {
      const prompt = new MultiSelect({
        message: 'Select an app to restart',
        choices: _.keys(config.app),
      })
      names = await prompt.run()
    } catch (error) {
      return
    }
  }
  for (const [hostName, host] of Object.entries(config.host)) {
    for (const name of names) {
      const app = config.app[name]
      if (app.host && app.host !== hostName) {
        continue
      }
      console.log(chalk.green(`${hostName} ${name} startOrRestart`))
      shell.exec(
        `ssh ${host} pm2 startOrRestart ${config.ecosystemPath} --only ${name}`
      )
    }
  }
})

program.command('run [command...]').action(command => {
  for (const [hostName, host] of Object.entries(config.host)) {
    console.log(chalk.green(`${hostName} run output:`))
    shell.exec(`ssh ${host} ${command.join(' ')}`)
  }
})

program.command('sudo [command...]').action(async command => {
  const prompt = new Password({
    message: '[sudo] password:',
  })
  const password = await prompt.run()
  for (const [hostName, host] of Object.entries(config.host)) {
    console.log(chalk.green(`${hostName} sudo output:`))
    const { stdout } = shell.exec(
      `echo ${password} | ssh -tt ${host} sudo ${command.join(' ')}`,
      { silent: true }
    )
    console.log(
      stdout
        .replace(/^.*\r\n/, '')
        .replace(/^.*\r\n/, '')
        .trim()
    )
  }
})

program.command('nginx').action(async () => {
  const prompt = new Password({
    message: '[sudo] password:',
  })
  const password = await prompt.run()
  const { code } = shell.exec(`echo ${password} | sudo -S nginx -t`, {
    silent: true,
  })
  if (code !== 0) {
    console.error(`nginx test fail`)
    return
  }
  for (const [hostName, host] of Object.entries(config.host)) {
    shell.exec(
      `echo ${password} | ssh -tt ${host} sudo systemctl restart nginx`,
      { silent: true }
    )
    console.log(`${hostName} nginx restart`)
  }
})

program.parse(process.argv)
