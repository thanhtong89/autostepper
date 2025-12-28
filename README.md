# AutoStepper MVP - Python Version

🎵 **Advanced StepMania chart generation using modern Music Information Retrieval**

A Python conversion of the Java AutoStepper with superior beat detection capabilities powered by `librosa` and cutting-edge audio analysis algorithms.

## 🚀 Features

- **Superior Beat Detection**: Uses research-grade librosa algorithms instead of basic Java implementations
- **Universal Audio Support**: Handles MP3, WAV, FLAC, OGG, and more formats seamlessly
- **Multiple Difficulties**: Easy, Medium, Hard, Expert with intelligent step pattern scaling
- **Advanced Analysis**: Real-time tempo detection, onset analysis, and confidence scoring
- **StepMania Compatible**: Exports standard .sm files ready for gameplay

## 🏁 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run AutoStepper

```bash
# Basic usage
python autostepper.py -i song.mp3

# Specify difficulty and output
python autostepper.py -i song.mp3 -d hard -o ./charts/

# Override metadata
python autostepper.py -i song.mp3 --title "My Song" --artist "My Artist" -v
```

### 3. YouTube Integration (Optional)

Download audio directly from YouTube for testing:

```bash
# Install YouTube downloader
pip install yt-dlp

# Download and test in one command
python download_demo.py -u "https://youtu.be/VIDEO_ID" --test -d medium

# Or download first, then process
python download_demo.py -u "https://youtu.be/VIDEO_ID" -o ./downloads/
python autostepper.py -i "./downloads/Song Title.mp3" -d hard -v
```

### 4. Import to StepMania

Copy the generated `.sm` file and your audio file to your StepMania songs folder.

**Note**: Output filenames automatically replace spaces with underscores for better compatibility:
- Input: `"My Favorite Song.mp3"` → Output: `My_Favorite_Song_medium.sm`

## 📊 Comparison with Java Version

| Feature | Java AutoStepper | Python MVP | Winner |
|---------|------------------|------------|---------|
| Beat Detection | Basic algorithms | Research-grade (librosa) | 🐍 **Python** |
| Audio Formats | Limited MP3 support | Universal format support | 🐍 **Python** |
| Development Speed | Complex setup | Simple dependencies | 🐍 **Python** |
| Step Quality | Good | Superior rhythm analysis | 🐍 **Python** |
| Deployment | JAR + JVM required | Standalone Python script | 🤝 **Both good** |

## 🎯 Command Line Options

```
Options:
  -i, --input TEXT        Input audio file (MP3, WAV, FLAC, etc.) [required]
  -o, --output TEXT       Output directory for .sm files [default: ./output]
  -d, --difficulty        Chart difficulty level [easy|medium|hard|expert]
  --title TEXT           Override song title
  --artist TEXT          Override artist name
  -v, --verbose          Verbose output with analysis details
  --help                 Show help message
```

## 🧪 Example Output

```bash
$ python autostepper.py -i "song.mp3" -d medium -v

🎵 Processing: song.mp3
📁 Output: ./output
🎯 Difficulty: medium
🔍 Analyzing audio and detecting beats...
   ✅ Detected BPM: 128.5
   ✅ Found 245 beats
   ✅ Confidence: 0.89
🚶 Generating step patterns...
   ✅ Generated 147 steps
💾 Exporting to song_medium.sm...
🎉 Successfully created: ./output/song_medium.sm
🎯 BPM: 128.5 | Steps: 147 | Difficulty: Medium
```

## 📁 Project Structure

```
autostepper/
├── autostepper.py              # Main CLI entry point
├── requirements.txt            # Python dependencies
├── autostepper/
│   ├── audio/
│   │   └── analyzer.py         # Beat detection with librosa
│   ├── stepgen/
│   │   └── generator.py        # Step pattern generation
│   └── formats/
│       └── stepmania.py        # .sm file export
```

## 🔧 Technical Details

- **Beat Detection**: Dynamic programming beat tracker with onset detection
- **Tempo Analysis**: Autocorrelation-based BPM estimation with stability analysis
- **Pattern Generation**: Difficulty-scaled step density with jump/hold support
- **Format Support**: Universal audio via librosa + soundfile backends
- **Confidence Scoring**: Beat-onset alignment with tempo consistency metrics

## 🆚 Advantages Over Java Version

### 🎵 **Superior Music Analysis**
- Research-grade beat detection algorithms
- Advanced onset detection and spectral analysis
- Tempo stability analysis and confidence scoring
- Access to cutting-edge MIR (Music Information Retrieval) techniques

### 🛠️ **Better Development Experience**
- Simpler dependency management (pip vs. JAR files)
- Rich ecosystem of audio processing libraries
- Easier to extend and modify
- Better error handling and debugging

### 📈 **Enhanced Accuracy**
- Librosa's beat tracking outperforms basic Java algorithms
- Multiple analysis layers (beats + onsets + tempo variations)
- Intelligent pattern generation based on musical structure
- Confidence-based quality assessment

## 🚧 Future Enhancements

- [ ] Web interface for drag-and-drop processing
- [ ] Batch processing for entire directories
- [ ] Advanced difficulty algorithms with machine learning
- [ ] Real-time visualization of beat detection
- [ ] Integration with online music databases for metadata

---

**AutoStepper MVP** - Making rhythm game chart creation accessible with modern Python and superior audio analysis! 🎮🎵