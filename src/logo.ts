import figlet from 'figlet';
import gradient from 'gradient-string';
import chalk from 'chalk';

const purpleMoon = `
       _.._
     .' .-'
    /  /
    |  |
    \\  \\
     '. '._
       '--'
`;

export function showLogo() {
    console.clear();
    const title = figlet.textSync('Luminine', { font: 'Slant', horizontalLayout: 'full' });
    console.log(gradient(['#8a2be2', '#4b0082', '#000000'])(title));
    console.log(gradient(['#8a2be2', '#4b0082'])(purpleMoon));
    console.log(chalk.italic.hex('#8a2be2')('  "The moon shines bright on your code."\n'));
    console.log(chalk.gray('  Version: 1.0.0'));
    console.log(chalk.gray('  Status: ') + chalk.green('Online'));
    console.log(chalk.gray('  System: ') + chalk.blue(process.platform) + '\n');
}
