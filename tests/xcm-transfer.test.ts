import { describe, it, expect } from 'vitest'
import { setStorage, DownwardMessage, } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing'
import { setupContext, testingPairs, sendTransaction} from '@acala-network/chopsticks-testing'
import { connectVertical, connectParachains } from '@acala-network/chopsticks'


const { check, checkSystemEvents, checkUmp, checkHrmp } = withExpect(expect);


import networks, { type Network } from './networks.js'

const downwardMessages: DownwardMessage[] = [
  {
    sentAt: 1,
    msg: '0x0210010400010000078155a74e390a1300010000078155a74e39010300286bee0d01000400010100c0cbffafddbe39f71f0190c2369adfc59eaa4c81a308ebcad88cdd9c400ba57c',
  },
]

describe('XCM', async () => {
  let frequency: Network
  let polkadot: Network
  let assetHub: Network
  let networksD: Network

  beforeEach(async () => {
    frequency = await networks.frequency()
    // frequency.chain.newBlock()
    // networksD = await networks.network()
    assetHub = await networks.assetHub()
    // assetHub.chain.newBlock()

    polkadot = await networks.polkadot()

    return async () => {
      await frequency.teardown()
      await polkadot.teardown()
      await assetHub.teardown()
    }
  })

  // it('Frequency handles downward messages', async () => {
  //   console.log('Creating new block with downward messages...')
  //   await frequency.chain.newBlock({ downwardMessages })
    
  //   console.log('Checking system events...')
  //   const events = await frequency.api.query.system.events()
  //   console.log('Raw system events:', JSON.stringify(events.toHuman(), null, 2))

    
  //   await checkSystemEvents(frequency).toMatchSnapshot()
  // })

  it('Polkadot send downward messages to frequency', async () => {
    await connectVertical(polkadot.chain, frequency.chain)

    const { alice, bob } = testingPairs()

    polkadot.dev.setStorage({
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 } }]],
      },
    })

    await polkadot.api.tx.xcmPallet
      .reserveTransferAssets(
        { V0: { X1: { Parachain: 2000 } } },
        {
          V0: {
            X1: {
              AccountId32: {
                network: 'Any',
                id: alice.addressRaw,
              },
            },
          },
        },
        {
          V0: [
            {
              ConcreteFungible: { id: 'Null', amount: 100e10 },
            },
          ],
        },
        0,
      )
      .signAndSend(alice)

    await polkadot.chain.newBlock()
    await checkSystemEvents(polkadot).toMatchSnapshot()

      console.log('taco-Frequency Events:')
    let result = await checkSystemEvents(polkadot).value();

    // let upward = await checkUmp(polkadot).value();
    // console.log('taco-Upward:', upward)
    
    result.map((event: any) => {
      console.log('taco-Event:', event)
      // console.log('taco-Event:', JSON.stringify(event.toHuman(), null, 2))
    });

      console.log('taco-Frequency Events After New Block:')
    await frequency.chain.newBlock()
    await checkSystemEvents(frequency).toMatchSnapshot()
  })

  it('frequency send upward messages to Polkadot', async () => {
    await connectVertical(polkadot.chain, frequency.chain)

    const { alice } = testingPairs()

    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 } }]],
      },
      ForeignAssets: {
        Account: [[
          [
            { 
              parents: 1,
              interior: "Here",
            },
            alice.address
          ],
          {
            balance: 10e10,
            status:  { "Liquid": null },
            reason: {'Consumer': null },
            extra: null,
          }
      ]],
      },
    })

    await check(polkadot.api.query.system.account(alice.address)).toMatchSnapshot()
    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot()
    await check(frequency.api.query.foreignAssets.account(  { 
      parents: 1,
      interior: "Here",
    }, alice.address)).toMatchSnapshot()

    // await frequency.api.tx.xTokens
    //   .transfer(
    //     {
    //       Token: 'DOT',
    //     },
    //     10e10,
    //     {
    //       V1: {
    //         parents: 1,
    //         interior: {
    //           X1: {
    //             AccountId32: {
    //               network: 'Any',
    //               id: alice.addressRaw,
    //             },
    //           },
    //         },
    //       },
    //     },
    //     {
    //       Unlimited: null,
    //     },
    //   )
    //   .signAndSend(alice)

    // await frequency.chain.newBlock()
    // await checkSystemEvents(frequency).toMatchSnapshot()
    // await check(frequency.api.query.tokens.accounts(alice.address, { token: 'DOT' })).toMatchSnapshot()

    // await polkadot.chain.newBlock()

    // await check(polkadot.api.query.system.account(alice.address)).toMatchSnapshot()
    // await checkSystemEvents(polkadot).toMatchSnapshot()
  })

  it("frequency send DOT to AssetHub", async () => {
    await connectParachains([frequency.chain, assetHub.chain], false)

    const blockNumberFrequency = (await frequency.api.rpc.chain.getHeader()).number.toNumber()
    frequency.dev.setHead(blockNumberFrequency)

    const blockNumberAssetHub = (await assetHub.api.rpc.chain.getHeader()).number.toNumber()
    assetHub.dev.setHead(blockNumberAssetHub)

    const { alice, bob} = testingPairs()
    // Setup AssetHub to be able to receive and process messages
    await setStorage(assetHub.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 0 } }]],
      },
    })

    
    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 } }]],
      },
      ForeignAssets: {
        Asset: [[
          [{parents: 1, interior: "Here"}],
          {supply: 1000e10, owner: alice.address}
        ]],
        Account: [[
          [
            { 
              parents: 1,
              interior: "Here",
            },
            alice.address
          ],
          {
            balance: 12e10,
            status:  { "Liquid": null },
            reason: {'Consumer': null },
            extra: null,
          }
      ]],
      },
      PolkadotXcm: {
        SafeXcmVersion: 3,
        SupportedVersion: [[
          [5, 
            {
              V5: {parents: 1, interior: {X1: [{Parachain: 1000}]}}
            }
          ],
          4,
        ]],
      }
    })


    const balance = await frequency.api.query.foreignAssets.account(  { 
      parents: 1,
      interior: "Here",
    }, alice.address);
    check(balance).toMatchSnapshot()
  
    const forceSubscribeVersionNotify = frequency.api.tx.polkadotXcm.forceSubscribeVersionNotify({V4:{parents: 1, interior: {X1: [{Parachain: 1000}]}}})
    await forceSubscribeVersionNotify.signAndSend(alice)
    await sendTransaction(forceSubscribeVersionNotify.signAsync(alice))
    await frequency.chain.newBlock()
    await checkSystemEvents(frequency).toMatchSnapshot('initial-events-force-subscribe-version-notify')

    let tx = await frequency.api.tx.polkadotXcm
      .limitedReserveTransferAssets(
        { 
          V3: { 
            parents: 1, 
            interior: { X1: { Parachain: 1000 } } 
          } 
        },
        { 
          V3: { 
            parents: 0, 
            interior: { 
              X1: { 
                AccountId32: { 
                  network: null, 
                  id: bob.addressRaw, 
                } 
              } 
            } 
          } 
        },
        { 
          V3: [
            { 
              id: { 
                Concrete: { 
                  parents: 1, 
                  interior: "Here" 
                } 
              }, 
              fun: { Fungible: 5e10 } 
            }
          ] 
        },
        0,
        'Unlimited'
      )

      await sendTransaction(tx.signAsync(alice)) 
      // await tx.signAndSend(alice)
      await frequency.chain.newBlock()

    await checkHrmp(frequency).redact({ redactKeys: /setTopic/ }).toMatchSnapshot('outbound-hrmp-messages')
    await checkSystemEvents(frequency).toMatchSnapshot('initial-events')
    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot('frequency-after-send')

    // console.log('=== CHECKING ASSET HUB BLOCK ===')
      // Check AssetHub inbox
  // before processing
  // const inboxBefore = await assetHub.api.query.parachainSystem.lastHrmpMqcHeads()
  // console.log('AssetHubinbox before block:',inboxBefore.toHuman())
  const inboxBefore = await assetHub.api.query.parachainSystem.lastHrmpMqcHeads()
  console.log('AssetHubinbox before block:',inboxBefore.toHuman())
    await assetHub.chain.newBlock()

  const inboxAfter= await assetHub.api.query.parachainSystem.lastHrmpMqcHeads()
  console.log('AssetHubinbox before block:',inboxAfter.toHuman())

    await checkSystemEvents(assetHub, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot('AssetHub chain xcm events')
    // await checkSystemEvents(assetHub).toMatchSnapshot('AssetHub chain xcm events')
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot("assethub-final-balance")


    // Verify XCM success/failure
    const events = await assetHub.api.query.system.events()
    // console.log('AssetHub events:', events.toHuman())
    const xcmResults = events.filter(({ event }) =>
      event.section === 'xcmpQueue' && ['Success', 'Fail'].includes(event.method)
    )
    // console.log('XCM Results:', xcmResults.map(e => `${e.event.method}: ${e.event.data}`))

  
    await check(frequency.api.query.foreignAssets.account(  { 
      parents: 1,
      interior: "Here",
    }, alice.address)).toMatchSnapshot('frequency-final-balance')

  }, 240000)
  
  it.only("AssetHub send DOT to Frequency", async () => {
    await connectParachains([assetHub.chain, frequency.chain], false)

    // const blockNumberFrequency = (await frequency.api.rpc.chain.getHeader()).number.toNumber()
    // frequency.dev.setHead(blockNumberFrequency)

    // const blockNumberAssetHub = (await assetHub.api.rpc.chain.getHeader()).number.toNumber()
    // assetHub.dev.setHead(blockNumberAssetHub)

    const { alice, bob, charlie} = testingPairs()
    // // Setup AssetHub to be able to receive and process messages
    await setStorage(assetHub.chain, {
      System: {
        Account: [
          [[alice.address], { data: { free: 1000 * 1e12 }, nonce: 1 }],  // Give alice balance
          [[charlie.address], { data: { free: 1000 * 1e12 }, nonce: 1 }]
        ],
      },
    })

    // check balance of alice in assetHub
    const balanceAssetHub = await assetHub.api.query.system.account(charlie.address);
    console.log('balanceAssetHub', balanceAssetHub.toHuman())
    check(balanceAssetHub).toMatchSnapshot()

    
    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 } }]],
      },
      ForeignAssets: {
        Asset: [[
          [{parents: 1, interior: "Here"}],
          {supply: 1000e10, owner: alice.address}
        ]],
        Account: [[
          [
            { 
              parents: 1,
              interior: "Here",
            },
            alice.address
          ],
          {
            balance: 12e10,
            status:  { "Liquid": null },
            reason: {'Consumer': null },
            extra: null,
          }
      ]],
      },
      PolkadotXcm: {
        SafeXcmVersion: 3,
        SupportedVersion: [[
          [5, 
            {
              V5: {parents: 1, interior: {X1: [{Parachain: 1000}]}}
            }
          ],
          4,
        ]],
      }
    })


    const balance = await frequency.api.query.foreignAssets.account({ 
      parents: 1,
      interior: "Here",
    }, alice.address);

    console.log('balance', balance.toHuman())
    check(balance).toMatchSnapshot()
  
    // const forceSubscribeVersionNotify = frequency.api.tx.polkadotXcm.forceSubscribeVersionNotify({V4:{parents: 1, interior: {X1: [{Parachain: 1000}]}}})
    // await forceSubscribeVersionNotify.signAndSend(alice)
    // await sendTransaction(forceSubscribeVersionNotify.signAsync(alice))
    await frequency.chain.newBlock()
    await checkSystemEvents(frequency).toMatchSnapshot('initial-events-force-subscribe-version-notify')

    

    // let tx = await assetHub.api.tx.polkadotXcm
    //   .limitedReserveTransferAssets(
    //     { 
    //       V3: { 
    //         parents: 1, 
    //         interior: { X1: { Parachain: 2091 } } 
    //       } 
    //     },
    //     { 
    //       V3: { 
    //         parents: 0, 
    //         interior: { 
    //           X1: { 
    //             AccountId32: { 
    //               network: null, 
    //               id: bob.addressRaw, 
    //             } 
    //           } 
    //         } 
    //       } 
    //     },
    //     { 
    //       V3: [
    //         { 
    //           id: { 
    //             Concrete: { 
    //               parents: 1, 
    //               interior: "Here" 
    //             } 
    //           }, 
    //           fun: { Fungible: 5e10 } 
    //         }
    //       ] 
    //     },
    //     0,
    //     'Unlimited'
    //   )

      // try {
        let blockNumber = (await assetHub.api.rpc.chain.getHeader()).number.toNumber();
        console.log('blockNumber', blockNumber)
        let account = await assetHub.api.query.system.account(charlie.address);
        const assetHubTx = await assetHub.api.tx.balances.transferKeepAlive(alice.address, 500)
        let result = await assetHubTx.signAndSend(charlie, {nonce: account.nonce.toNumber() + 1});
        // let result = await sendTransaction(assetHubTx.signAsync(charlie))
      //   console.log('result', result)
      // } catch (error) {
      //   console.log('error', error)
      // }
    //   let result = await sendTransaction(assetHubTx.signAsync(charlie))
    // console.log('result', result)
    //   } catch (error) {
    //     console.log('error', error)
    //   }
      // await assetHubTx.signAndSend(charlie)

      // const isValid = await tx.(alice);
      // await sendTransaction(tx.signAsync(alice)) 
      // await tx.signAndSend(charlie)
      // await assetHub.chain.newBlock()

    // await checkHrmp(assetHub).redact({ redactKeys: /setTopic/ }).toMatchSnapshot('outbound-hrmp-messages')
    // await checkSystemEvents(assetHub).toMatchSnapshot('initial-events')
    // await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot('frequency-after-send')

    // console.log('=== CHECKING ASSET HUB BLOCK ===')
      // Check AssetHub inbox
  // before processing
  // const inboxBefore = await assetHub.api.query.parachainSystem.lastHrmpMqcHeads()
  // console.log('AssetHubinbox before block:',inboxBefore.toHuman())
  // const inboxBefore = await frequency.api.query.parachainSystem.lastHrmpMqcHeads()
  // console.log('AssetHubinbox before block:',inboxBefore.toHuman())
  //   await frequency.chain.newBlock()

  // const inboxAfter= await frequency.api.query.parachainSystem.lastHrmpMqcHeads()
  // console.log('AssetHubinbox before block:',inboxAfter.toHuman())

  //   await checkSystemEvents(frequency, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot('AssetHub chain xcm events')
    // await checkSystemEvents(assetHub).toMatchSnapshot('AssetHub chain xcm events')
    // await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot("assethub-final-balance")


    // Verify XCM success/failure
    // const events = await assetHub.api.query.system.events()
    // console.log('AssetHub events:', events.toHuman())
    // const xcmResults = events.filter(({ event }) =>
    //   event.section === 'xcmpQueue' && ['Success', 'Fail'].includes(event.method)
    // )
    // console.log('XCM Results:', xcmResults.map(e => `${e.event.method}: ${e.event.data}`))

  
    // await check(assetHub.api.query.foreignAssets.account(  { 
    //   parents: 1,
    //   interior: "Here",
    // }, bob.address)).toMatchSnapshot('frequency-final-balance')

  }, 240000)
})