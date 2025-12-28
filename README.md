# AutoStepper MVP - Python Version

**Advanced StepMania/ITGMania chart generation using modern Music Information Retrieval**

A Python conversion of the original Java AutoStepper with superior beat detection capabilities powered by `librosa` and cutting-edge audio analysis algorithms.

## Attribution

This project is inspired by and builds upon the original [AutoStepper](https://github.com/phr00t/AutoStepper) by [phr00t](https://github.com/phr00t). The original Java implementation provided the foundation for automatically generating StepMania charts from audio files. This Python version enhances the concept with:

- Research-grade beat detection using librosa
- YouTube integration for complete song packaging
- All difficulties in a single .ssc file (ITGMania compatible)
- Professional StepMania package distribution
- Superior audio format support

**Original Repository**: https://github.com/phr00t/AutoStepper
**Original Author**: phr00t

## Features

- **Superior Beat Detection**: Uses research-grade librosa algorithms instead of basic Java implementations
- **Universal Audio Support**: Handles MP3, WAV, FLAC, OGG, and more formats seamlessly
- **Multiple Difficulties**: Easy, Medium, Hard, Challenge - all in a single .ssc file
- **Advanced Analysis**: Real-time tempo detection, onset analysis, and confidence scoring
- **ITGMania Compatible**: Exports modern .ssc format with all difficulties in one file

## Quick Start

### 1. Set Up Virtual Environment

```bash
# Create virtual environment (first time only)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # Linux/macOS
# or
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt
```

### 2. Run AutoStepper

**Note**: Always activate the virtual environment before running any commands:
```bash
source venv/bin/activate  # Linux/macOS
```

```bash
# Basic usage - generates all difficulties in a single .ssc file
python autostepper.py -i song.mp3

# Specify output directory
python autostepper.py -i song.mp3 -o ./charts/

# Override metadata
python autostepper.py -i song.mp3 --title "My Song" --artist "My Artist" -v
```

### 3. YouTube Integration & Complete Pipeline

AutoStepper MVP includes powerful YouTube integration for complete song packaging:

#### **Method 1: Complete Pipeline (Recommended)**
```bash
# One command: Download → Generate all difficulties → Package for distribution
python youtube_to_stepmania.py -u "https://www.youtube.com/watch?v=VIDEO_ID"

# Creates ready-to-distribute .zip file with all difficulties in one .ssc file
```

#### **Method 2: Manual Download + Process**
```bash
# Download first, then process
python download_demo.py -u "https://youtu.be/VIDEO_ID" -o ./downloads/
python autostepper.py -i "./downloads/Song Title.mp3" -v
```

#### **Package Contents:**
```
stepmania_packages/
└── Artist-Song_Title/
    ├── song.mp3              # High-quality audio
    ├── song.ssc              # All difficulties in one file
    ├── banner.png            # Auto-generated banner
    └── README.txt            # Installation instructions
```

### 4. Song Packaging & Distribution

AutoStepper MVP automatically creates distribution-ready StepMania packages:

#### **For StepMania/ITGMania Users:**
```bash
# They receive: Artist-Song_Title.zip
# They extract to: StepMania/Songs/
# They refresh: Press F5 in StepMania
# Ready to play: Song appears with all difficulties!
```

#### **Manual Packaging (if needed):**
```bash
# Package existing charts for distribution
python package_song.py -a "song.mp3" -c "./charts/song.ssc" --zip

# Creates complete StepMania package with banner and README
```

### 5. Import to StepMania/ITGMania

Copy the generated `.ssc` file and your audio file to your StepMania songs folder, or use the auto-generated packages.

**Note**: Output filenames automatically trim spaces and replace special characters with underscores for better compatibility:
- Input: `"  My Favorite Song.mp3"` → Output: `My_Favorite_Song.ssc`

## Comparison with Java Version

| Feature | Java AutoStepper | Python MVP | Winner |
|---------|------------------|------------|---------|
| Beat Detection | Basic algorithms | Research-grade (librosa) | **Python** |
| Audio Sources | Local files only | YouTube + local files | **Python** |
| Audio Formats | Limited MP3 support | Universal format support | **Python** |
| Chart Generation | Single difficulty | All difficulties automatically | **Python** |
| Output Format | Legacy .sm | Modern .ssc (ITGMania) | **Python** |
| Packaging | Manual file copying | Complete StepMania packages | **Python** |
| Distribution | Individual files | Ready-to-share zip files | **Python** |
| Step Quality | Good | Superior rhythm analysis | **Python** |

## Available Tools

AutoStepper MVP includes multiple specialized tools for different workflows:

| Tool | Purpose | Best For |
|------|---------|----------|
| `autostepper.py` | Core chart generation | Processing local audio files |
| `youtube_to_stepmania.py` | Complete YouTube pipeline | One-command YouTube → StepMania |
| `download_demo.py` | YouTube download + basic processing | Testing beat detection |
| `package_song.py` | Manual song packaging | Packaging existing charts |
| `quick_download.py` | Simple YouTube download | When FFmpeg is unavailable |

### **Recommended Workflow:**
```bash
# For YouTube videos (most common)
python youtube_to_stepmania.py -u "YOUTUBE_URL"

# For local files
python autostepper.py -i "song.mp3" -v
```

## Command Line Options

### **autostepper.py**
```
Options:
  -i, --input TEXT        Input audio file (MP3, WAV, FLAC, etc.) [required]
  -o, --output TEXT       Output directory for .ssc file [default: ./output]
  --title TEXT           Override song title
  --artist TEXT          Override artist name
  -v, --verbose          Verbose output with analysis details
  --help                 Show help message
```

## Example Output

```bash
$ python autostepper.py -i "song.mp3" -v

Processing: song.mp3
Output: ./output
Analyzing audio and detecting beats...
   Detected BPM: 128.5
   Found 245 beats
   Confidence: 0.89
Generating step patterns for all difficulties...
   Easy: 98 steps
   Medium: 147 steps
   Hard: 196 steps
   Expert: 233 steps
Exporting to song.ssc...
Successfully created: ./output/song.ssc
BPM: 128.5 | Difficulties: 4
Total steps generated: 674
```

## Real-World Example Output

From our test with the NIKKE game soundtrack:

```
Input: https://www.youtube.com/watch?v=VRpkhNiEkWA
Output: 5.4MB complete StepMania package

Package Contents:
├── NIKKE_OST_Bulletstorm.mp3     # 5.4MB audio
├── NIKKE_OST_Bulletstorm.ssc     # All 4 difficulties
├── banner.png                     # Auto-generated 256x80 banner
└── README.txt                     # Installation instructions

Beat Detection: High confidence, professional quality
Processing Time: ~30 seconds total
Ready for Distribution: One zip file, ready to share!
```

## Project Structure

```
autostepper/
├── autostepper.py              # Core chart generator
├── youtube_to_stepmania.py     # Complete YouTube pipeline
├── download_demo.py            # YouTube download + processing
├── package_song.py             # Manual StepMania packaging
├── quick_download.py           # Simple YouTube downloader
├── requirements.txt            # Python dependencies
├── autostepper/                # Core library modules
│   ├── audio/
│   │   └── analyzer.py         # Beat detection with librosa
│   ├── stepgen/
│   │   └── generator.py        # Step pattern generation
│   └── formats/
│       └── stepmania_ssc.py    # .ssc file export
└── tests/                      # Test files and demos
```

## Technical Details

- **Beat Detection**: Dynamic programming beat tracker with onset detection
- **Tempo Analysis**: Autocorrelation-based BPM estimation with stability analysis
- **Pattern Generation**: Difficulty-scaled step density with jump/hold support
- **Format Support**: Universal audio via librosa + soundfile backends
- **Output Format**: Modern .ssc format compatible with ITGMania and StepMania 5
- **Confidence Scoring**: Beat-onset alignment with tempo consistency metrics

## Advantages Over Java Version

### **Superior Music Analysis**
- Research-grade beat detection algorithms
- Advanced onset detection and spectral analysis
- Tempo stability analysis and confidence scoring
- Access to cutting-edge MIR (Music Information Retrieval) techniques

### **Better Development Experience**
- Simpler dependency management (pip vs. JAR files)
- Rich ecosystem of audio processing libraries
- Easier to extend and modify
- Better error handling and debugging

### **Enhanced Accuracy**
- Librosa's beat tracking outperforms basic Java algorithms
- Multiple analysis layers (beats + onsets + tempo variations)
- Intelligent pattern generation based on musical structure
- Confidence-based quality assessment

## Future Enhancements

- [x] **YouTube Integration** - Complete pipeline from URL to StepMania package
- [x] **Song Packaging System** - Distribution-ready zip files with banners
- [x] **Multiple Difficulty Generation** - All levels in single .ssc file
- [x] **ITGMania Compatibility** - Modern .ssc format support
- [ ] Web interface for drag-and-drop processing
- [ ] Batch processing for entire directories
- [ ] Advanced difficulty algorithms with machine learning
- [ ] Real-time visualization of beat detection
- [ ] Integration with online music databases for metadata

---

## License & Credits

**AutoStepper MVP** - Making rhythm game chart creation accessible with modern Python and superior audio analysis!

### Original Work Attribution:
- **Original AutoStepper**: [phr00t/AutoStepper](https://github.com/phr00t/AutoStepper)
- **Original Author**: [phr00t](https://github.com/phr00t)
- **Concept**: Automated StepMania chart generation from audio files

### Python Implementation:
- **Enhanced Version**: This Python MVP with modern MIR techniques
- **Key Libraries**: librosa (beat detection), yt-dlp (YouTube integration)
- **Additional Features**: Complete packaging pipeline, multiple difficulties, ITGMania support

This project respectfully builds upon phr00t's pioneering work in automated rhythm game chart generation, extending the concept with modern Python audio analysis capabilities.
