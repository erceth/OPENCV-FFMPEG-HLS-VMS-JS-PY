// globals: config, hls, _, $ // TODO: webpack

const DETECT_URL = 'detect';

_.forEach(config.cameras, (cam) => {
  videoPlayer(cam)
});

function videoPlayer(videoOptions) { // component
  let fragmentTree;
  const index = videoOptions.index;
  let userPath = [];
  let latestSegment;

  // create elements
  const $container = $(`<div id="video-player-${index}" class="video-player"></div>`);
  const video = document.createElement('video');
  // video.controls = true; // TODO: remove
  video.autoplay = true;
  video.muted = true;
  const $controls = $(`<div class="controls"></div>`);
  const $back = $(`<button class="action">back</button>`).click(() => {
    back();
  });
  let $live = $(`<button class="action">live</button>`).click(() => {
    live();
  });
  $controls.append($back, $live);

  // TODO: add +10 and -10 seconds buttons
  let $history = $('<div class="history"><ul></ul></div>');
  $container.append(video, $controls, $history)

  $('#main').append($container);
  if (Hls.isSupported()) {
    var hls = new Hls({levelLoadingMaxRetry: 0});
    hls.loadSource(`camera${index}.m3u8`);
    hls.attachMedia(video);
    hls.on(Hls.Events.LEVEL_LOADED, function(a, b) {
      if (fragmentTree) {
        _.forEachRight(b.details.fragments, (fragment) => {
          const path = getFragmentPath(fragment);
          if (_.has(fragmentTree, path)) {
            return false;
          } else { // only add new fragments
            $.getJSON( DETECT_URL, function( detect ) {
              addDetect(detect, fragment);
              fragment.displayDate = formatDate(fragment.rawProgramDateTime);
              _.setWith(fragmentTree, path, fragment, Object)
            });
          }
        });
        latestSegment = _.last(_.get(b, ['details', 'fragments']), latestSegment);
      } else {
        fragmentTree = {};
        $.getJSON( DETECT_URL, function( detect ) {
          _.forEach(b.details.fragments, (fragment) => {
            addDetect(detect, fragment);
            const path = getFragmentPath(fragment);
            fragment.displayDate = formatDate(fragment.rawProgramDateTime);
            _.setWith(fragmentTree, path, fragment, Object);
          });
        });
        latestSegment = _.last(_.get(b, ['details', 'fragments']), latestSegment);
        live();
      }
      createButtons();
    });

    hls.on(Hls.Events.ERROR, function(event, data) {
      console.log(data.type, data.details, data.fatal)
    });
  }

  function createButtons() {
    const directoryOrSegment = _.get(fragmentTree, userPath, fragmentTree);
    if (userPath.length < 3) {
      draw(_.keys(directoryOrSegment)) // it's a directory
    } else {
      draw(directoryOrSegment); // it's a segment
    }
  }

  function draw(currentLevel) {
    let eventElements = [];
    _.forEach(currentLevel, (child) => {
      const $el = $(`<button ${child.detect ? 'class="detect"' : ''} >${child.displayDate ? child.displayDate : child}</button>`).click(() => {
        clickSegment(child, child.start, child.relurl);
      })
      eventElements.push($el);
      // eventElements += `<li onclick="clickSegment('${child.relurl}', ${child.start}, '${child.relurl}')">${child.relurl || child}</li>`
    });
    const $history = $(`#video-player-${index} .history ul`).empty();
    $history.append(eventElements);
  }

  function live() {
    userPath = getFragmentPath(latestSegment);
    userPath.pop();
    clickSegment(_.last(userPath), latestSegment.start);
    createButtons();
  }

  function back() {
    userPath.pop();
    createButtons();
  }

  function clickSegment(nextPath, start, file) {
    if (_.isNumber(start)) {
      if (hls.media) {
        hls.media.currentTime = start;
        video.play();
      }
    } else {
      userPath.push(nextPath);
      createButtons();
    }
  }
}

function addDetect(detect, fragment) {
  const relurl = fragment.relurl.split('/')
  const file = relurl[relurl.length - 1];
  if (detect[file]) {
    fragment.detect = detect[file];
  }
}

function getFragmentPath(fragment) {
  const date = fragment.relurl.replace(/^camera*.\/|.ts$/gi, ''); // remove "camera0/" and ".ts"
  const path = date.split('/');
  return path;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} ${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

// function removeOlderFragments(path, pathIndex) {
//   const timeUnit = path[pathIndex]; // years, months, days, fileName
//   if (pathIndex >= path.length - 1) {  // fileName
//     const oldestAllowedSegment = _.get(fragmentTree, path);
//     const oldDirectoryPath = path.slice(null, path.length - 1);
//     const allowedSegments = _.filter(_.get(fragmentTree, oldDirectoryPath), (segment) => {
//       return segment.start >= oldestAllowedSegment.start;
//     });
//     _.setWith(fragmentTree, oldDirectoryPath, allowedSegments, Object);
//   } else { // years, months, days
//     for (let i = timeUnit - 1; i >= 0; i--) {
//       const pathWithOlderTimeUnit = _.clone(path);
//       pathWithOlderTimeUnit[pathIndex] = i;

//       if (_.has(fragmentTree, pathWithOlderTimeUnit)) {
//         _.unset(fragmentTree, pathWithOlderTimeUnit);
//       } else {
//         break;
//       }
//     }
//     removeOlderFragments(path, pathIndex + 1);
//   }
// }


