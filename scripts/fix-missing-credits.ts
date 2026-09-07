import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { AppointmentStatus } from '../src/modules/appointments/schemas/appointment.schema';
import { WalletsService } from '../src/modules/wallets/wallets.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection = app.get(getConnectionToken());
  const walletsService = app.get(WalletsService);
  
  try {
    const appointments = await connection.collection('appointments').find({
      status: { $in: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      paymentStatus: 'success',
      commitmentFee: { $gt: 0 }
    }).toArray();

    let fixedCount = 0;
    
    for (const appt of appointments) {
      // Find the vendor
      const vendor = await connection.collection('vendors').findOne({ _id: appt.vendor });
      if (!vendor || !vendor.owner) continue;
      
      const reference = appt.paymentReference;
      
      // Check if wallet already has this credit
      const existingTx = await connection.collection('transactions').findOne({
        wallet: vendor.owner,
        reference: reference
      });
      
      if (!existingTx) {
        console.log(`Fixing missing credit for appointment ${appt._id} (${appt.commitmentFee})`);
        try {
          await walletsService.creditWallet(
            vendor.owner.toString(),
            appt.commitmentFee,
            `Commitment fee for appointment ${appt._id}`,
            undefined,
            reference
          );
          fixedCount++;
        } catch (e) {
          console.error(`Error crediting ${appt._id}: ${e.message}`);
        }
      }
    }
    console.log(`Done. Fixed ${fixedCount} missing credits.`);
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  await app.close();
  process.exit(0);
}
bootstrap();
