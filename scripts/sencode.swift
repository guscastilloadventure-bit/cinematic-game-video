// sencode.swift: streaming JPEG frames -> H.264 MP4 (video only), deleting each frame once it is in the video,
// so a full render never needs more than a few frames of disk (the Mac's disk was full on 2026-10-21).
//   swiftc -O sencode.swift -o sencode
//   ./sencode <framesDir> <out.mp4> <width> <height> <fps> <bitrate> <totalFrames>
// Waits for f00000.jpg, f00001.jpg ... to appear (the renderer writes them), writes <framesDir>/done.txt with the
// number of frames already encoded so a restarted renderer can skip them. A frame counts as written once the
// next one exists or done.txt is behind by more than a second.
import AVFoundation
import CoreImage
import Foundation

let a = CommandLine.arguments
guard a.count == 8 else { print("usage: sencode <framesDir> <out.mp4> <w> <h> <fps> <bitrate> <total>"); exit(2) }
let dir = URL(fileURLWithPath: a[1]), outURL = URL(fileURLWithPath: a[2])
let W = Int(a[3])!, H = Int(a[4])!, FPS = Int32(a[5])!, BITRATE = Int(a[6])!, TOTAL = Int(a[7])!
try? FileManager.default.removeItem(at: outURL)

let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
let color: [String: Any] = [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                            AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                            AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]
let vIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
  AVVideoColorPropertiesKey: color,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: BITRATE, AVVideoMaxKeyFrameIntervalKey: Int(FPS),
                                    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                                    AVVideoH264EntropyModeKey: AVVideoH264EntropyModeCABAC,
                                    AVVideoExpectedSourceFrameRateKey: Int(FPS), AVVideoAllowFrameReorderingKey: true],
])
vIn.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: vIn, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
  kCVPixelBufferIOSurfacePropertiesKey as String: [:],
])
writer.add(vIn)
guard writer.startWriting() else { print("start failed", writer.error ?? ""); exit(1) }
writer.startSession(atSourceTime: .zero)

let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
let ci = CIContext(options: [.workingColorSpace: srgb, .outputColorSpace: srgb, .useSoftwareRenderer: false])
let fm = FileManager.default
func name(_ i: Int) -> URL { dir.appendingPathComponent(String(format: "f%05d.jpg", i)) }
func markDone(_ n: Int) { try? "\(n)\n".write(to: dir.appendingPathComponent("done.txt"), atomically: true, encoding: .utf8) }

var i = 0
markDone(0)
while i < TOTAL {
  // a frame is complete once the next one exists (the renderer writes in order), or it has sat still for 1.5 s
  let url = name(i)
  var ready = false
  if fm.fileExists(atPath: url.path) {
    if i == TOTAL - 1 || fm.fileExists(atPath: name(i + 1).path) { ready = true }
    else if let at = try? fm.attributesOfItem(atPath: url.path)[.modificationDate] as? Date, Date().timeIntervalSince(at) > 1.5 { ready = true }
  }
  if !ready { Thread.sleep(forTimeInterval: 0.05); continue }
  while !vIn.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
  var ok = false
  autoreleasepool {
    guard var img = CIImage(contentsOf: url) else { return }
    let sx = CGFloat(W) / img.extent.width
    if abs(sx - 1) > 1e-6 {
      let f = CIFilter(name: "CILanczosScaleTransform")!
      f.setValue(img, forKey: kCIInputImageKey); f.setValue(sx, forKey: kCIInputScaleKey)
      f.setValue(CGFloat(H) / (img.extent.height * sx), forKey: kCIInputAspectRatioKey)
      img = f.outputImage!.cropped(to: CGRect(x: 0, y: 0, width: W, height: H))
    }
    var pb: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
    ci.render(img, to: pb!, bounds: CGRect(x: 0, y: 0, width: W, height: H), colorSpace: srgb)
    if !adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: FPS)) { print("append failed", writer.error ?? ""); exit(1) }
    ok = true
  }
  if !ok { Thread.sleep(forTimeInterval: 0.2); continue }   // half-written JPEG: try again
  try? fm.removeItem(at: url)
  i += 1
  markDone(i)
  if i % 120 == 0 { print("encoded \(i) / \(TOTAL)"); fflush(stdout) }
}
vIn.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed { print("failed", writer.error ?? ""); exit(1) }
print("wrote \(outURL.path): \(TOTAL) frames @ \(FPS) fps, \(W)x\(H)")
