// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "NebulaVaultNative",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "nebulavault-cli", targets: ["NebulaVaultNative"])
    ],
    targets: [
        .executableTarget(
            name: "NebulaVaultNative",
            path: "Sources/NebulaVaultNative"
        )
    ]
)
