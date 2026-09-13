import Flutter
import PDFKit
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  private var pdfDocument: PDFDocument?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    let registrar = self.registrar(forPlugin: "VidhyaVibePdfPages")
    if let messenger = registrar?.messenger() {
      let channel = FlutterMethodChannel(
        name: "vidhyavibe/pdf_pages",
        binaryMessenger: messenger
      )
      channel.setMethodCallHandler { [weak self] call, result in
        self?.handlePdfCall(call, result: result)
      }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  private func handlePdfCall(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "open":
      let args = call.arguments as? [String: Any]
      guard let path = args?["path"] as? String else {
        result(FlutterError(code: "pdf_error", message: "path required", details: nil))
        return
      }
      pdfDocument = PDFDocument(url: URL(fileURLWithPath: path))
      result(pdfDocument?.pageCount ?? 0)

    case "renderPage":
      let args = call.arguments as? [String: Any]
      let pageNumber = (args?["page"] as? NSNumber)?.intValue ?? 1
      let maxWidth = (args?["maxWidth"] as? NSNumber)?.intValue ?? 1080
      guard let page = pdfDocument?.page(at: pageNumber - 1) else {
        result(FlutterError(code: "pdf_error", message: "page not found", details: nil))
        return
      }
      let bounds = page.bounds(for: .mediaBox)
      let scale = CGFloat(max(maxWidth, 320)) / max(bounds.width, 1)
      let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
      let image = page.thumbnail(of: size, for: .mediaBox)
      guard let data = image.jpegData(compressionQuality: 0.82) else {
        result(FlutterError(code: "pdf_error", message: "encode failed", details: nil))
        return
      }
      result(FlutterStandardTypedData(bytes: data))

    case "close":
      pdfDocument = nil
      result(nil)

    case "extractText":
      guard let doc = pdfDocument else {
        result(FlutterError(code: "pdf_error", message: "pdf not open", details: nil))
        return
      }
      var pages: [String] = []
      pages.reserveCapacity(doc.pageCount)
      for i in 0..<doc.pageCount {
        pages.append(doc.page(at: i)?.string ?? "")
      }
      result(pages)

    default:
      result(FlutterMethodNotImplemented)
    }
  }
}
