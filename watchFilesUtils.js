const fsAsync = require("fs").promises;

module.exports = {
  getLatestTransportFile: async (index) => {
    const now = new Date();
    const dirPath = `camera${index}/${now.getFullYear()}/${padMonthOrDate(now.getMonth() + 1)}/${padMonthOrDate(now.getDate())}`;
    try {
      var dirCont = await fsAsync.readdir(dirPath);
    } catch(error) {
      console.error(error); // TODO: redo error handling
      return;
    }
    if (!dirCont) {
      console.error('dirCont empty');
      return;
    }
    let recentTempfile = dirCont.find(( file ) => file.match(/.*\.(tmp)/ig));
  
    if (!recentTempfile){
      console.error('recentTempfile');
      return;
    }
    const recentFile = recentTempfile.split('.tmp')[0];
    return recentFile;
  }
}

function padMonthOrDate(mOrD) {
  return mOrD.toString().length < 2 ? '0' + mOrD : mOrD;
}