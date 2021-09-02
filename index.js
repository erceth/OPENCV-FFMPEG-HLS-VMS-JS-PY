const { spawn } = require('child_process');
const config = require('./config-server');
const _ = require('lodash');
const express = require('express')
const fs = require('fs');
const wfu = require('./watchFilesUtils');
const chokidar = require('chokidar');

const app = express()
const port = 3000
const TSFilesWithDetection = {};

const {
  segmentTime,
  listSize,
  pythonPath, 
  imshow,
  writeOutput,
  writeTransparentOutput
} = config.general;

_.forEach(config.cameras, (cam, index) => {
  delayStart(cam, index);
});

// spreads out the initial start
function delayStart(cam, index) {
  setTimeout(() => {
    startStream(cam, index)
  }, index * 1000);
}

function startStream (cam, index) {
  console.log('starting stream' + index);
  removeOldRecordings(index);

  const outputDetect = `output-detect${index}.png`;
  if (!fs.existsSync(outputDetect)) {
    fs.copyFileSync('output-detect.png', outputDetect);
  }

  const cameraDir = `camera${index}`;
  if (!fs.existsSync(cameraDir)) {
    fs.mkdirSync(cameraDir);
  }

  const {
    inputFps,
    detectFps,
    height,
    width,
    minPixelSize,
    motionDeltaThreshold,
    motionPaddingCutoutPercent,
    cutOutHeightLimit,
    checkNLargestObjects,
    windowStride,
    hogPadding,
    hogScale,
    hogHitThreshold,
    nonMaxSuppressionThreshold,
  } = cam.detectParameters;

  const streamInput = cam.input ? cam.input : `rtsp://${cam.ip}${cam.path}`;
  
  const command = [
    '-i', `${streamInput}`,
    '-loop', 1, '-f', 'image2', '-i', `output-detect${index}.png`, 
    '-filter_complex', `[0:v]fps=${inputFps}[slow];[slow][1:v]overlay`, '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', '-g', '30', '-sc_threshold', 0, '-c:a', 'aac', '-b:a', '128k', '-ac', 2, /* '-maxrate', '550k', '-bufsize', '1000k', */'-f', 'hls', '-hls_time', segmentTime, '-hls_list_size', listSize, '-hls_delete_threshold', 1, '-hls_flags', 'independent_segments+delete_segments+append_list+temp_file+program_date_time', '-strftime', 1, '-strftime_mkdir', 1, '-hls_segment_filename', `camera${index}/%Y/%m/%d/%Y-%m-%dT%H:%M:%S.ts`, `camera${index}.m3u8`,
    '-map', '0:v', '-f', 'image2pipe', '-vf', `fps=${detectFps}`, '-pix_fmt', 'bgr24', '-vcodec', 'rawvideo', '-an', 'pipe:1'];

  if (cam.input) {
    command.unshift('-re')
  }

  // const stringCommand = command.join(' ');
  // console.log('ffmpeg arguments:', stringCommand);

  const ffmpegSpawn = spawn('ffmpeg', command);
  const detectSpawn = spawn(pythonPath, ['detect-wrapper.py',
    index,
    height,
    width,
    minPixelSize,
    motionDeltaThreshold,
    motionPaddingCutoutPercent,
    cutOutHeightLimit,
    checkNLargestObjects,
    windowStride,
    hogPadding,
    hogScale,
    hogHitThreshold,
    nonMaxSuppressionThreshold,
    imshow,
    writeOutput,
    writeTransparentOutput
  ]);

  watchForTSFileRemoval(index);

  // images output on stdout
  ffmpegSpawn.stdout.on('data', (data) => {
    detectSpawn.stdin.write(data);
  })
  ffmpegSpawn.stderr.on('data', (data) => {
    // console.log('ffmpegStdErr', String(data));
  })
  ffmpegSpawn.on('close', (code) => {
     console.log(`ffmpeg child process exited with code ${code}`); // TODO: restart. End process and rely on pm2 to restart?
 });


  detectSpawn.stdout.on('data', async (data) => {
    console.log('detectSpawn:stdout', String(data));
    const detectResponse = Number(data);
    try {
      if (detectResponse > 0) {
        // TODO: fix off by one
        const currentTransportFile = await wfu.getLatestTransportFile(index);
        if (!(TSFilesWithDetection[currentTransportFile] < detectResponse)) {
          TSFilesWithDetection[currentTransportFile] = detectResponse;
        }
      }
      // TODO: call function that writes detectResponse to JSON file
    } catch(err) {
      console.error('could not save detection')
    }
  })
  detectSpawn.stderr.on('data', (data) => {
    console.log('detectSpawn:stderr', String(data));
    console.error('detectSpawn stderr', String(data));
  })
  detectSpawn.on('close', (code) => {
    console.log(`detectSpawn child process exited with code ${code}`); // TODO: respawn detect?
  });
  detectSpawn.on('exit', (code) => {
    console.log(`detectSpawn exited with code ${code}`);
  });
};

app.get('/detect', (req, res) => {
  res.json(TSFilesWithDetection);
})

app.use(express.static(__dirname))

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})

function watchForTSFileRemoval(index) {
  chokidar.watch(`camera${index}`, {ignored: /(^|[\/\\])\../}).on('unlink', (removedFilePath) => {
    if (removedFilePath.match(/ts$/ig)) {
      const removedFile = _.last(removedFilePath.split('/'));
      delete TSFilesWithDetection[removedFile];
      // TODO: call function that writes detectResponse to JSON file
    }
  });
}

function removeOldRecordings(i) {
  try {
    fs.rmdirSync(`camera${i}`, { recursive: true });
    fs.unlinkSync(`camera${i}.m3u8`);
  } catch(err) {
    console.error(err)
  }
}
