import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ReferralsService } from '../src/modules/referrals/referrals.service';
import { getModelToken } from '@nestjs/mongoose';
import { Facilitator } from '../src/modules/referrals/schemas/facilitator.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const referralsService = app.get(ReferralsService);
  const facilitatorModel = app.get(getModelToken(Facilitator.name));

  const email = 'abahmarquis@gmail.com';
  const name = 'Abah Marquis';
  const skill = 'Software engineer';

  console.log(`Checking for facilitator ${email}...`);
  
  let fac = await facilitatorModel.findOne({ email });
  
  if (fac) {
    console.log('Facilitator exists. Updating skill and resending email...');
    fac.skill = skill;
    await fac.save();
    
    // Resend email
    await referralsService.resendFacilitatorWelcomeEmail(fac._id.toString());
    console.log('Updated and email sent successfully!');
  } else {
    console.log('Facilitator does not exist. Creating and sending email...');
    await referralsService.createFacilitator({
      name,
      email,
      skill,
      sendWelcomeEmail: true
    });
    console.log('Created and email sent successfully!');
  }
  
  await app.close();
  process.exit(0);
}

bootstrap();
