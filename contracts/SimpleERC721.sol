//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";

contract SimpleERC721 is ERC721PresetMinterPauserAutoId
{
    constructor() ERC721PresetMinterPauserAutoId("SimpleERC721", "SE721", "https://simple721.com/")
    {
        
    }
}
