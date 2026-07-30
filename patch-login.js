const fs = require('fs');
const file = '/Users/marquis/erranders/backend/src/modules/auth/auth.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }`,
  `    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      console.error('Password mismatch for user:', user.email);
      console.error('Provided password:', loginDto.password);
      console.error('Hash in DB:', user.password);
      throw new UnauthorizedException('Invalid credentials');
    }`
);

fs.writeFileSync(file, code);
