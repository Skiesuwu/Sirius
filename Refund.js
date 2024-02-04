app.post("/fortnite/api/game/v2/profile/*/client/RefundMtxPurchase", verifyToken, async (req, res) => {
    
    const profiles = await Profile.findOne({ accountId: req.user.accountId });

    let profile = profiles.profiles[req.query.profileId];
    let athena = profiles.profiles["athena"];


    var ApplyProfileChanges = [];
    let MultiUpdate = [{
        "profileRevision": athena.rvn || 0,
        "profileId": "athena",
        "profileChangesBaseRevision": athena.rvn || 0,
        "profileChanges": [],
        "profileCommandRevision": athena.commandRevision || 0,
    }];
    var BaseRevision = profile.rvn;
    var QueryRevision = req.query.rvn || -1;
    var StatChanged = false;
    let ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;

    var ItemCost = [];
    var ItemGuids = [];

    if (req.body.purchaseId) {
        MultiUpdate.push({
            "profileRevision": athena.rvn || 0,
            "profileId": "athena",
            "profileChangesBaseRevision": athena.rvn || 0,
            "profileChanges": [],
            "profileCommandRevision": athena.commandRevision || 0,
        })

        profile.stats.attributes.mtx_purchase_history.refundsUsed += 1;
        profile.stats.attributes.mtx_purchase_history.refundCredits -= 1;

        for (var i = 0; i < profile.stats.attributes.mtx_purchase_history.purchases.length; i++) {
            if (profile.stats.attributes.mtx_purchase_history.purchases[i].purchaseId == req.body.purchaseId) {
                for (var x = 0; x < profile.stats.attributes.mtx_purchase_history.purchases[i].lootResult.length; x++) {
                    ItemGuids.push(profile.stats.attributes.mtx_purchase_history.purchases[i].lootResult[x].itemGuid)
                }
                profile.stats.attributes.mtx_purchase_history.purchases[i].refundDate = new Date().toISOString();
            }
        }
        for (var i = 0; i < ItemGuids.length; i++) {
            delete athena.items[ItemGuids[i]]

            MultiUpdate[0].profileChanges.push({
                "changeType": "itemRemoved",
                "itemId": ItemGuids[i]
            })
        }

        athena.rvn += 1;
        athena.commandRevision += 1;
        profile.rvn += 1;
        profile.commandRevision += 1;

        StatChanged = true;
    }

    if (StatChanged == true) {
        profile.updated = new Date().toISOString();

        await profile.updateOne({ $set: { [`profiles.${req.query.profileId}`]: profile } });


        ApplyProfileChanges.push({
            "changeType": "statModified",
            "name": "mtx_purchase_history",
            "value": profile.stats.attributes.mtx_purchase_history
        })

        MultiUpdate[0].profileRevision = athena.rvn || 0;
        MultiUpdate[0].profileCommandRevision = athena.commandRevision || 0;
    }

    
   if (QueryRevision != ProfileRevisionCheck) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    res.json({
        profileRevision: profile.rvn || 0,
        profileId: req.query.profileId,
        profileChangesBaseRevision: BaseRevision,
        profileChanges: ApplyProfileChanges,
        profileCommandRevision: profile.commandRevision || 0,
        serverTime: new Date().toISOString(),
        responseVersion: 1
    });
});
