import { KoReaderAnnotation } from '@koinsight/common/types/annotation';
import { KoReaderBook } from '@koinsight/common/types/book';
import { Device } from '@koinsight/common/types/device';
import { PageStat } from '@koinsight/common/types/page-stat';
import archiver from 'archiver';
import { Router } from 'express';
import path from 'path';
import { requireAuth } from '../auth/auth-middleware';
import { CoverBackfillService } from '../books/covers/cover-backfill-service';
import { DeviceRepository } from '../devices/device-repository';
import { UploadService } from '../upload/upload-service';

// Router for KoInsight koreader plugin.
//
// There is deliberately no plugin version gate. It used to reject anything but one exact
// version, which meant every server release stopped all devices syncing until each plugin
// was updated by hand on the e-reader. The plugin still sends `version`; it is just ignored.
const router = Router();

router.post('/device', async (req, res) => {
  const { id, model } = req.body;

  if (!id || !model) {
    res.status(400).json({ error: 'Missing device ID or model' });
    return;
  }

  const device: Device = { id, model };

  try {
    console.debug('Registering device:', device);
    await DeviceRepository.insertIfNotExists(device);
    res.status(200).json({ message: 'Device registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registering device' });
  }
});

router.post('/import', async (req, res) => {
  const contentLength = req.headers['content-length'];
  console.warn(`[${req.method}] ${req.url} — Content-Length: ${contentLength || 'unknown'} bytes`);

  const koreaderBooks: KoReaderBook[] = req.body.books;
  const newPageStats: PageStat[] = req.body.stats;
  const annotations: Record<string, KoReaderAnnotation[]> = req.body.annotations || {};
  const deviceId: string | undefined = req.body.device_id; // For annotation sync path

  try {
    console.debug('Importing books:', koreaderBooks);
    console.debug('Importing page stats:', newPageStats);
    console.debug(
      'Importing annotations:',
      Object.keys(annotations).length,
      'books with annotations'
    );

    await UploadService.uploadStatisticData(koreaderBooks, newPageStats, annotations, deviceId);
    res.status(200).json({ message: 'Upload successful' });

    // Deliberately after the response and not awaited: the plugin is waiting on this socket
    // and Open Library is far slower than the import itself.
    void CoverBackfillService.backfillMissing(koreaderBooks ?? []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error importing data' });
  }
});

// TODO: implement check in koreader plugin
router.get('/health', async (_, res) => {
  res.status(200).json({ message: 'Plugin is healthy' });
});

router.get('/download', requireAuth, (_, res) => {
  const folderPath = path.join(__dirname, '../../../../', 'plugins');
  const archive = archiver('zip', { zlib: { level: 9 } });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename=koinsight.plugin.zip');

  archive.on('error', (err) => {
    console.error('Archive error:', err);
    res.status(500).send('Error creating zip');
  });

  // Pipe the archive directly to the response
  archive.pipe(res);

  // Add folder contents to the archive
  archive.directory(folderPath, false);

  archive.finalize();
});

export { router as kopluginRouter };
